import React from "react";

export default function DesignPreview() {
  const figmaEmbedSrc =
    "https://www.figma.com/embed?embed_host=share&url=https%3A%2F%2Fwww.figma.com%2Ffile%2FU5lB1L0YPampYrr4Zs0HDj%2FUntitled%3Fnode-id%3D0%253A1";

  return (
    <main style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "2rem" }}>
      <h1 style={{ marginBottom: "1rem" }}>Design & Prototype Preview</h1>

      <div style={{ width: "100%", maxWidth: 1200 }}>
        <iframe
          title="Figma prototype"
          src={figmaEmbedSrc}
          style={{ border: "1px solid rgba(0,0,0,0.1)", width: "100%", height: 560 }}
          allowFullScreen
          loading="lazy"
        />
      </div>

      <p style={{ marginTop: 12 }}>
        If the embed is blocked, open the prototype directly: {" "}
        <a
          href="https://www.figma.com/file/U5lB1L0YPampYrr4Zs0HDj/Untitled?node-id=0%3A1"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open in Figma
        </a>
      </p>
    </main>
  );
}
