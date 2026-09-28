"use server";

import { getPostPeerClient } from "@/lib/postpeer/client";
import { PostContent, Post } from "@/lib/postpeer/types";
import { getOrgId } from "@/lib/actions/helpers";

export async function publishPost(content: PostContent): Promise<Post> {
  await getOrgId();
  try {
    const client = getPostPeerClient();
    return await client.createPost(content);
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : "Failed to publish post"
    );
  }
}

export async function schedulePost(content: PostContent): Promise<Post> {
  await getOrgId();
  try {
    const client = getPostPeerClient();
    return await client.schedulePost(content);
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : "Failed to schedule post"
    );
  }
}

export async function uploadMedia(
  file: File
): Promise<{ url: string; id: string }> {
  await getOrgId();
  try {
    const client = getPostPeerClient();
    return await client.uploadMedia(file);
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : "Failed to upload media"
    );
  }
}
