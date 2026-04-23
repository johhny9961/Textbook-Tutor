import { WifiOff } from "lucide-react";

interface OfflineBannerProps {
  message: string;
}

export function OfflineBanner({ message }: OfflineBannerProps) {
  return (
    <div className="offline-banner" role="status">
      <WifiOff size={14} />
      <span>{message}</span>
    </div>
  );
}
