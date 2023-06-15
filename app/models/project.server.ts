import type {
  Channel as ChannelModel,
  Project as ProjectModel,
  TikTokCredentials,
  YoutubeCredentials,
} from "@prisma/client";

import { prisma } from "~/db.server";

type UpdatedChannel = Omit<ChannelModel, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

type UpdatedProject = Omit<ProjectModel, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

export type Project = UpdatedProject & {
  channels: UpdatedChannel[];
  youtubeCredentials: YoutubeCredentials | null;
  tikTokCredentials: TikTokCredentials | null;
};

export async function getProject({ id }: { id: string }): Promise<Project> {
  const project = await prisma.project.findUniqueOrThrow({
    where: {
      id: id,
    },
    include: {
      channels: true,
      youtubeCredentials: true,
      tikTokCredentials: true,
    },
  });

  return {
    ...project,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    channels: project.channels.map((channel) => ({
      ...channel,
      createdAt: channel.createdAt.toISOString(),
      updatedAt: channel.updatedAt.toISOString(),
    })),
  };
}
