import { useState, type ImgHTMLAttributes } from "react";

type Props = ImgHTMLAttributes<HTMLImageElement>;
const fallback = "/images/deportes/placeholder.svg";

export default function ImageFallback({ src, onError, ...props }: Props) {
  const [failed, setFailed] = useState(false);
  return (
    <img
      {...props}
      src={failed || !src ? fallback : src}
      onError={(event) => {
        if (failed || !src || src === fallback) {
          event.currentTarget.style.visibility = "hidden";
          return;
        }
        setFailed(true);
        onError?.(event);
      }}
    />
  );
}
