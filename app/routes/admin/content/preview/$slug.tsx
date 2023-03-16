import invariant from "tiny-invariant";
import type { LoaderFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

import { getContent } from "~/models/content.server";
import { getUser } from "~/session.server";
import { Routes } from "~/routes";

type LoaderData = {
  content: Awaited<ReturnType<typeof getContent>>;
  user: Awaited<ReturnType<typeof getUser>>;
};

export const loader: LoaderFunction = async ({ params, request }) => {
  const slug = params.slug;

  invariant(slug, "slug is required");

  const user = await getUser(request);

  if (!user) {
    return redirect(Routes.Login);
  }

  invariant(user?.currentProjectId, "user must have a current project");

  return json({
    user,
    content: await getContent({
      slug,
      projectId: user.currentProjectId,
    }),
  });
};

export default function Page() {
  const { content } = useLoaderData<LoaderData>();

  return (
    <main>
      <h1>{content.title}</h1>
      <div style={{ display: `grid`, gridTemplateColumns: `1fr 1fr` }}>
        {content.video ? (
          <video
            src={`https://storage.googleapis.com/${content.projectId}/${content.slug}.mp4`}
            controls
            style={{ width: `100%` }}
            autoPlay
            muted
          />
        ) : null}
        {content.thumbnail ? (
          <img
            src={`https://storage.googleapis.com/${content.projectId}/${content.slug}.jpg`}
            alt={content.title}
            style={{ width: `100%`, position: `sticky`, top: `0` }}
          />
        ) : null}
      </div>
    </main>
  );
}
