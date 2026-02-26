"use client";

import { useRef, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "~/trpc/react";

const ACCEPTED_FILE_TYPES = ["image/jpeg", "image/png", "image/heic", "application/pdf"];
type AcceptedMimeType = "image/jpeg" | "image/png" | "image/heic" | "application/pdf";

interface UseReceiptUploadOptions {
  groupId: number;
  initialUrl?: string | null;
}

interface UploadState {
  file: File | null;
  url: string | null;
}

export function useReceiptUpload({ groupId, initialUrl = null }: UseReceiptUploadOptions) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const getUploadUrlMutation = api.group.uploadReceipt.useMutation();

  const uploadMutation = useMutation<UploadState, Error, File>({
    mutationFn: async (file: File) => {
      // Step 1: Get upload instructions from server
      const result = await getUploadUrlMutation.mutateAsync({
        groupId,
        fileName: file.name,
        mimeType: file.type as AcceptedMimeType,
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      const { uploadUrl, publicUrl } = result.data;

      // Step 2: If provider gives an upload URL, upload directly
      if (uploadUrl) {
        const response = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });

        if (!response.ok) {
          throw new Error("Failed to upload receipt.");
        }
      }

      return { file, url: publicUrl };
    },
  });

  const currentFile = uploadMutation.data?.file ?? null;
  const currentUrl = uploadMutation.data?.url ?? initialUrl;

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
        throw new Error("Invalid file type. Accepted: JPG, PNG, HEIC, PDF.");
      }

      await uploadMutation.mutateAsync(file);
    },
    [uploadMutation],
  );

  const removeReceipt = useCallback(() => {
    uploadMutation.reset();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [uploadMutation]);

  const reset = useCallback(
    () => {
      uploadMutation.reset();
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [uploadMutation],
  );

  return {
    fileInputRef,
    file: currentFile,
    url: currentUrl,
    isPending: uploadMutation.isPending,
    error: uploadMutation.error?.message ?? null,
    handleFileChange,
    removeReceipt,
    reset,
  };
}
