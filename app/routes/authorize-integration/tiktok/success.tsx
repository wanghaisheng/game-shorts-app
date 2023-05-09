import type { LoaderFunction } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { fetch } from "@remix-run/node";
import invariant from "tiny-invariant";

import { getUser } from "~/session.server";
import { prisma } from "~/db.server";
import { Routes } from "~/routes";

/* 
In the loader function
1. Get the code from the query params
2. Fetch the access token from TikTok using the authorization code: https://open-api.tiktok.com/oauth/access_token/
3. Store the access token and associated values in the database
*/

export const loader: LoaderFunction = async ({ request }) => {
  const user = await getUser(request);

  if (!user) {
    return redirect(Routes.Login);
  }

  invariant(
    typeof user.currentProjectId === "string",
    "Current project is required"
  );

  const url = new URL(request.url);
  const authorizationCode = url.searchParams.get("code");

  if (!authorizationCode) {
    return redirect("/authorize-integration/tiktok");
  }

  const response = await fetch(
    "https://open-api.tiktok.com/oauth/access_token/",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_key: process.env.TIKTOK_CLIENT_KEY,
        client_secret: process.env.TIKTOK_CLIENT_SECRET,
        code: authorizationCode,
        grant_type: "authorization_code",
      }),
    }
  );

  const data = await response.json();

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      projects: {
        update: {
          where: {
            id: user.currentProjectId,
          },
          data: {
            tikTokCredentials: {
              upsert: {
                create: {
                  accessToken: data.access_token,
                  refreshToken: data.refresh_token,
                  refreshTokenExpiresIn: data.refresh_expires_in,
                  scope: data.scope,
                  openId: data.open_id,
                },
                update: {
                  accessToken: data.access_token,
                  refreshToken: data.refresh_token,
                  refreshTokenExpiresIn: data.refresh_expires_in,
                  scope: data.scope,
                  openId: data.open_id,
                },
              },
            },
          },
        },
      },
    },
  });

  return redirect(Routes.Admin);
};
