import { cssBundleHref } from "@remix-run/css-bundle";
import type {
  ActionFunction,
  LinksFunction,
  LoaderArgs,
  MetaFunction,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  Form,
  Link,
  useLoaderData,
  useLocation,
  useSubmit,
} from "@remix-run/react";
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";
import { zfd } from "zod-form-data";

import stylesheet from "../node_modules/@t_g/default-ui/package/index.css";
import { prisma } from "./db.server";
import { Routes } from "./routes";
import { getUser } from "./session.server";
import localStyles from "./styles/index.css";

export const links: LinksFunction = () => {
  return [
    {
      rel: "icon",
      href: "/favicon.png",
      type: "image/png",
    },
    {
      rel: "stylesheet",
      href: stylesheet,
      type: "text/css",
    },
    {
      rel: "stylesheet",
      href: localStyles,
      type: "text/css",
    },
    ...(cssBundleHref ? [{ rel: "stylesheet", href: cssBundleHref }] : []),
  ];
};

export const meta: MetaFunction = () => ({
  charset: "utf-8",
  title: "Vertical Shorts Platform",
  viewport: "width=device-width,initial-scale=1",
});

type LoaderData = {
  user: ReturnType<typeof getUser> extends Promise<infer U> ? U : never;
};

const schema = zfd.formData({
  currentProjectId: zfd.text().optional(),
  userId: zfd.text().optional(),
});

export const action: ActionFunction = async ({ request }) => {
  const { currentProjectId, userId } = schema.parse(await request.formData());

  if (!currentProjectId || !userId) {
    throw new Error("Missing required fields");
  }

  const user = prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      currentProjectId,
    },
  });

  return user;
};

export async function loader({ request }: LoaderArgs) {
  return json<LoaderData>({ user: await getUser(request) });
}

export default function App() {
  const location = useLocation();
  const submit = useSubmit();

  const { user } = useLoaderData<LoaderData>();

  const project = user?.projects.filter(
    (project) => project.id === user.currentProjectId
  )[0];

  return (
    <html lang="en">
      <head>
        <Meta />
        <Links />
        {location.pathname === Routes.Signup ? (
          <script
            async
            src="https://js.stripe.com/v3/pricing-table.js"
          ></script>
        ) : null}
      </head>
      <body>
        <header>
          <menu>
            <details>
              <summary>Menu</summary>
              <nav>
                <ul
                  style={{
                    marginTop: 0,
                  }}
                >
                  <li>
                    <Link
                      to={Routes.Index}
                      data-current={
                        location.pathname === Routes.Index ? true : undefined
                      }
                    >
                      <h3>
                        {project?.title.trim().length
                          ? project.title
                          : "Content"}
                      </h3>
                    </Link>
                  </li>
                  <li>
                    <Link
                      to={Routes.Admin}
                      data-current={
                        location.pathname === Routes.Admin
                          ? true
                          : undefined
                          ? true
                          : undefined
                      }
                    >
                      <h3>Settings</h3>
                    </Link>
                  </li>

                  <li>
                    <Link
                      to={Routes.AdminContentTitle}
                      data-current={
                        location.pathname.includes(Routes.AdminContentTitle)
                          ? true
                          : undefined
                      }
                    >
                      <h3>Publish</h3>
                    </Link>
                  </li>
                </ul>
              </nav>

              <fieldset style={{ padding: `0 var(--space-md)` }}>
                <Form method="post">
                  <label htmlFor="currentProjectId">Select Project</label>
                  <br />
                  <select
                    id="currentProjectId"
                    name="currentProjectId"
                    onChange={(event) => {
                      if (!user?.id) return;

                      submit(
                        {
                          currentProjectId: event.target.value,
                          userId: user.id,
                        },
                        {
                          method: "post",
                        }
                      );
                    }}
                  >
                    {user?.projects.map((project) => (
                      <option
                        key={project.id}
                        value={project.id}
                        selected={project.id === user.currentProjectId}
                      >
                        {project.title}
                      </option>
                    ))}
                  </select>
                </Form>
                <Link to={Routes.AdminCreateProject}>
                  <button
                    style={{
                      marginBlockEnd: `var(--space-sm)`,
                    }}
                  >
                    New
                  </button>
                </Link>
              </fieldset>
            </details>
          </menu>
        </header>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}
