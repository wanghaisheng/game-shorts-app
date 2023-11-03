import type { PlanType } from "@prisma/client";
import { ChannelType } from "@prisma/client";
import type { ActionFunction, LoaderArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { zfd } from "zod-form-data";

import { prisma } from "~/db.server";
import { type Channel, getChannels } from "~/models/chanel.server";
import { getProject } from "~/models/project.server";
import { Routes } from "~/routes";
import { getUser } from "~/session.server";
import { SUPPORTED_CHANNELS } from "~/utils/constants";

type LoaderData = {
  user?: Awaited<ReturnType<typeof getUser>>;
  channels?: Awaited<ReturnType<typeof getChannels>>;
  project?: Awaited<ReturnType<typeof getProject>>;
};

export const loader = async ({ request }: LoaderArgs) => {
  const user = await getUser(request);

  if (!user?.id) {
    return redirect(Routes.Login);
  }

  if (!user.currentProjectId) {
    return redirect(Routes.AdminCreateProject);
  }

  return json<LoaderData>({
    user,
    project: await getProject({
      id: user.currentProjectId,
    }),
    channels: await getChannels({
      projectId: user.currentProjectId,
    }),
  });
};

const schema = zfd.formData({
  currentProjectId: zfd.text().optional(),
  userId: zfd.text().optional(),
});

export const action: ActionFunction = async ({ request }) => {
  const { currentProjectId, userId } = schema.parse(await request.formData());

  if (!currentProjectId || !userId) {
    return redirect(Routes.Login);
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

export default function Page() {
  const { user, project } = useLoaderData<LoaderData>();

  if (!user) return null;

  const channelTypes = Object.keys(ChannelType) as ChannelType[];

  const channelsToAdd = channelTypes.filter(
    (channelType) =>
      !project?.channels.find((channel) => channel.channelType === channelType)
  );

  return (
    <main>
      <h1>Settings</h1>
      <hr />
      <h2>{project?.title}</h2>
      <h3> Publish To:</h3>
      <section>
        {channelTypes.flatMap((channelType) => {
          const channel = project?.channels.find(
            (channel) => channel.channelType === channelType
          );
          return channel ? (
            <ChannelItem key={channelType} channel={channel} />
          ) : (
            []
          );
        })}
      </section>
      {channelsToAdd.length ? (
        <section>
          <h3>Add Channels</h3>
          {channelsToAdd.map((channelType) => (
            <Link
              key={channelType}
              to={
                SUPPORTED_CHANNELS.includes(channelType)
                  ? getRouteFromChannelType(channelType)
                  : "#"
              }
            >
              <article
                data-coming-soon={!SUPPORTED_CHANNELS.includes(channelType)}
              >
                <h2>
                  {SUPPORTED_CHANNELS.includes(channelType)
                    ? getChannelNameFromChannelType(channelType)
                    : ` ${getChannelNameFromChannelType(
                        channelType
                      )} - Coming Soon`}
                </h2>
              </article>
            </Link>
          ))}
        </section>
      ) : null}
      <hr />
      <h2
        style={{
          marginBlockStart: 0,
        }}
      >
        {user.planType ? "Update Plan" : "Select Plan"}
      </h2>
      <Link to={Routes.Signup}>
        <button type="button">
          <h3>
            {user.planType
              ? ` ${getPlanFromPlanType(user.planType)}`
              : `Select Plan`}
          </h3>
        </button>
      </Link>
      <hr />
    </main>
  );
}

function getPlanFromPlanType(planType: PlanType) {
  switch (planType) {
    case "STARTER":
      return "Starter";
    case "GROWTH":
      return "Growth";
    case "PROFESSIONAL":
      return "Professional";
  }
}

function getRouteFromChannelType(channelType: ChannelType) {
  switch (channelType) {
    case "YOUTUBE":
      return Routes.AuthorizeYoutube;
    case "TIKTOK":
      return Routes.AuthorizeTikTok;
    case "INSTAGRAM":
      return Routes.AuthorizeInstagram;
    case "TWITTER":
      return Routes.AuthorizeTwitter;
    case "FACEBOOK":
      return Routes.AuthorizeFacebook;
  }
}

function getChannelNameFromChannelType(channelType: ChannelType) {
  switch (channelType) {
    case "YOUTUBE":
      return "YouTube";
    case "TIKTOK":
      return "TikTok";
    case "INSTAGRAM":
      return "Instagram";
    case "TWITTER":
      return "Twitter";
    case "FACEBOOK":
      return "Facebook";
  }
}

function ChannelItem({ channel }: { channel: Channel }) {
  return (
    <Link
      to={
        SUPPORTED_CHANNELS.includes(channel.channelType)
          ? getRouteFromChannelType(channel.channelType)
          : "#"
      }
    >
      <article
        data-coming-soon={!SUPPORTED_CHANNELS.includes(channel.channelType)}
        style={{
          marginBlockEnd: `var(--space-lg)`,
        }}
      >
        {channel.thumbnail ? (
          <img
            src={channel.thumbnail}
            alt=""
            style={{
              width: "100%",
            }}
          />
        ) : null}
        <h2>{channel.name}</h2>
        <ul
          style={{
            color: `var(--text-color)`,
            marginBlockEnd: `var(--space-sm)`,
            paddingInlineStart: `var(--space-md)`,
          }}
        >
          {channel.subscribers ? (
            <li>Subscribers: {channel.subscribers}</li>
          ) : null}
          {channel.views ? <li>Views: {channel.views}</li> : null}
          <li>Updated At: {channel.updatedAt}</li>
        </ul>
        <a href={getRouteFromChannelType(channel.channelType)}>
          <button>Other Channel</button>
        </a>
      </article>
    </Link>
  );
}
