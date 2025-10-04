import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UploadButtonProps {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}

export default function UploadButton({ icon: Icon, label, onClick, disabled }: UploadButtonProps) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      className="w-full h-auto py-6 px-8 text-lg font-semibold"
      data-testid={`button-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <Icon className="w-6 h-6 mr-3" />
      {label}
    </Button>
  );
}
