import { ImageResponse } from "next/og";

export const contentType = "image/png";

export function generateImageMetadata() {
  return [
    { contentType: "image/png", size: { width: 192, height: 192 }, id: "192" },
    { contentType: "image/png", size: { width: 512, height: 512 }, id: "512" },
  ];
}

export default async function Icon({ id }: { id: Promise<string> }) {
  const sizeId = await id;
  const size = sizeId === "512" ? 512 : 192;
  const r = Math.round(size * 0.22);
  const pad = Math.round(size * 0.22);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#005A54",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: size - pad * 2,
            height: size - pad * 2,
            borderRadius: r,
            border: `${Math.max(8, size / 24)}px solid #FF5C5C`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: size * 0.42,
            fontWeight: 700,
          }}
        >
          M
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
