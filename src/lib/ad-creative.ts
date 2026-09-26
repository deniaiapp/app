import { isIP } from "node:net";
import { z } from "zod";

export const adCreativeSchema = z.strictObject({
  title: z.string().trim().min(3).max(100),
  description: z.string().trim().min(10).max(240),
  url: z
    .url()
    .max(2048)
    .refine((value) => {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        url.hostname.includes(".") &&
        !isIP(url.hostname) &&
        !url.hostname.endsWith(".local")
      );
    }),
});
