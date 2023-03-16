import { Form, useTransition } from "@remix-run/react";
import type { ActionFunction, LoaderFunction } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { upsertContent } from "~/models/content.server";
import { Routes } from "~/routes";
import { getUser } from "~/session.server";
import invariant from "tiny-invariant";

export const loader: LoaderFunction = async ({ request }) => {
  const user = await getUser(request);

  if (!user) {
    return redirect(Routes.Login);
  }

  return {};
};

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const title = formData.get("title");

  invariant(typeof title === "string", "title is required");

  const user = await getUser(request);

  if (!user?.currentProjectId) {
    return redirect(Routes.AdminCreateProject);
  }

  const slug = title.toString().trim().toLowerCase().replace(/ /g, "-");

  await upsertContent({
    slug,
    title: title.toString().trim(),
    projectId: user.currentProjectId,
  });

  return redirect(Routes.AdminContentThumbnail(slug));
};

export default function Page() {
  const transition = useTransition();

  return (
    <main>
      <fieldset
        disabled={
          transition.state === "loading" || transition.state === "submitting"
        }
      >
        <h2>Create a New Post</h2>
        <Form method="post">
          <label>
            Title
            <br />
            <input
              type="text"
              name="title"
              required
              style={{
                width: `calc(100% - 8px)`,
                marginBlockStart: `8px`,
              }}
            />
          </label>
          <button
            type="submit"
            style={{
              width: `100%`,
              marginBlockStart: `16px`,
            }}
          >
            Next
          </button>
        </Form>
      </fieldset>
    </main>
  );
}
