import { handleUpload } from "@vercel/blob/client";
import { roleOf } from "../../../lib/db";

export async function POST(req) {
  const body = await req.json();
  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!roleOf(req, clientPayload || "")) throw new Error("locked");
        return { allowedContentTypes: ["audio/*", "video/mp4"], maximumSizeInBytes: 200 * 1024 * 1024 };
      },
      onUploadCompleted: async () => {},
    });
    return Response.json(json);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 });
  }
}
