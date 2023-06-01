const express = require("express");
const { Storage } = require("@google-cloud/storage");
const fs = require("fs");
const { google } = require("googleapis");
require("dotenv").config();

const { PrismaClient, UploadStatus } = require("./generated");
const { UPLOAD_SERVICE_BASE_URL } = require("./utils/constants");

const app = express();
app.use(express.json());

const prisma = new PrismaClient();

const storage = new Storage();

app.post("/upload", async (req, res) => {
  console.log("getting file");
  const { projectId, slug } = req.body;

  console.log(projectId, "projectId", slug, "slug");

  const content = await prisma.content.findUniqueOrThrow({
    where: {
      projectId_slug: {
        projectId,
        slug,
      },
    },
    select: {
      project: {
        select: {
          youtubeCredentials: true,
          tikTokCredentials: true,
        },
      },
    },
  });

  console.log(content, "content");

  const filePath = `${slug}.mp4`;

  try {
    storage
      .bucket(projectId)
      .file(filePath)
      .createReadStream()
      .pipe(fs.createWriteStream(filePath))
      .on("open", () => {
        res.send("dl started");
      })
      .on("finish", () => {
        console.log("dl finished");
        if (content.project.youtubeCredentials) {
          fetch(`${UPLOAD_SERVICE_BASE_URL}/upload-youtube-short`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              projectId,
              slug,
            }),
          });
        }

        if (content.project.tikTokCredentials) {
          console.log("todo call tiktok endpoint");
        }
      })
      .on("error", (err) => {
        console.log(err);
        res.status(500).send("Something went wrong!");
      });
  } catch (error) {
    console.log(error);
    res.status(500).send("Error downloading file");
  }
});

app.post("/upload-youtube-short", async (req, res) => {
  const { projectId, slug } = req.body;

  const content = await prisma.content.update({
    where: {
      projectId_slug: {
        projectId,
        slug,
      },
    },
    select: {
      title: true,
      description: true,
      tags: true,
    },
    data: {
      youtubeStatus: UploadStatus.UPLOADING,
    },
  });

  const project = await prisma.project.findUnique({
    where: {
      id: projectId,
    },
    select: {
      youtubeCredentials: true,
    },
  });

  const oauth2Client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URL
  );

  oauth2Client.setCredentials({
    access_token: project.youtubeCredentials.accessToken,
    refresh_token: project.youtubeCredentials.refreshToken,
  });

  const youtube = google.youtube({
    version: "v3",
    auth: oauth2Client,
  });

  const filePath = `${req.body.slug}.mp4`;
  const bodyStream = fs.createReadStream(filePath);

  youtube.videos
    .insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: {
          title: content.title,
          description: content.description,
          tags: content.tags,
        },
        status: {
          privacyStatus: "private",
        },
      },
      media: {
        mimeType: "video/mp4",
        body: bodyStream,
      },
    })
    .then(async (response) => {
      console.log(response, "yt_response");

      await prisma.content.update({
        where: {
          projectId_slug: {
            projectId,
            slug,
          },
        },
        data: {
          youtubeStatus: UploadStatus.PRIVATE,
        },
      });

      res.send("Video uploaded to youtube");
    })
    .catch(async (error) => {
      console.log(error, "yt_error");

      await prisma.content.update({
        where: {
          projectId_slug: {
            projectId,
            slug,
          },
        },
        data: {
          youtubeStatus: UploadStatus.NOT_STARTED,
        },
      });
    });
});

app.post("/upload-tiktok", async (req, res) => {
  const { projectId, slug } = req.body;

  const project = await prisma.project.findUnique({
    where: {
      id: projectId,
    },
    select: {
      tikTokCredentials: true,
    },
  });

  if (!project.tikTokCredentials) {
    throw new Error("no tiktok credentials");
  }

  const videoFilePath = `${slug}.mp4`;

  const videoStats = fs.statSync(videoFilePath);
  const videoBinary = fs.readFileSync(videoFilePath);

  const videoSize = videoBinary.length;
  const minChunkSize = 5 * 1024 * 1024; // 5 MB in bytes
  const maxChunkSize = 64 * 1024 * 1024; // 64 MB in bytes
  const maxFinalChunkSize = 128 * 1024 * 1024; // 128 MB in bytes
  const totalChunkCount = Math.ceil(videoSize / maxChunkSize);
  const chunkSize = Math.floor(videoSize / totalChunkCount);

  const getVideoChunks = () => {
    if (videoSize < minChunkSize) {
      // Upload the entire video as a single chunk
      return [videoBinary];
    } else if (videoSize <= maxChunkSize) {
      // Upload the entire video as a single chunk, since it's less than or equal to the maximum chunk size
      return [videoBinary];
    } else {
      const chunks = [];
      let remainingBytes = videoSize;
      let offset = 0;

      for (let i = 0; i < totalChunkCount; i++) {
        let currentChunkSize = chunkSize;

        if (i === totalChunkCount - 1) {
          // Last chunk can be greater to accommodate any trailing bytes
          currentChunkSize = Math.min(remainingBytes, maxFinalChunkSize);
        }

        const chunk = videoBinary.slice(offset, offset + currentChunkSize);
        chunks.push(chunk);

        offset += currentChunkSize;
        remainingBytes -= currentChunkSize;
      }

      return chunks;
    }
  };

  const videoChunks = getVideoChunks();

  try {
    const initRes = await fetch(
      `https://open.tiktokapis.com/v2/post/publish/inbox/video/init/`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${project.tikTokCredentials.accessToken}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({
          source: "FILE_UPLOAD",
          video_size: videoStats.size,
          chunk_size: chunkSize,
          total_chunk_count: totalChunkCount,
        }),
      }
    );

    if (!initRes.ok) {
      console.log(initRes, "initRes.error");
      // get response body
      const initResJson = await initRes.json();

      console.log(initResJson, "initResJson");

      throw new Error("ERROR_INITIALIZING_TIKTOK_UPLOAD");
    }

    const { data } = await initRes.json();

    const { upload_url, publish_id } = data;

    console.log(upload_url, "upload_url");
    console.log(publish_id, "publish_id");

    await Promise.all(
      videoChunks.map(async (chunk, index) => {
        const headers = {
          "Content-Type": "video/mp4",
          "Content-Length": chunk.length,
          "Content-Range": `bytes ${index * chunkSize}-${
            index * chunkSize + chunk.length - 1
          }/${videoSize}`,
        };

        const chunkUploadRes = await fetch(upload_url, {
          method: "PUT",
          headers,
          body: chunk,
        });

        if (!chunkUploadRes.ok) {
          console.log(chunkUploadRes, "chunkUploadRes error");
          throw new Error("ERROR_UPLOADING_TIKTOK_CHUNK");
        }

        const json = await chunkUploadRes.json();
        console.log(json, "chunkUploadRes json");

        return chunkUploadRes;
      })
    );

    // call check titkok upload status endpoint with publish_id
  } catch (error) {
    console.log(error, "error initializing tiktok upload");
  }
});

const port = parseInt(process.env.PORT) || 8080;

app.listen(port, () => {
  console.log(`listening on port ${port}`);
});
