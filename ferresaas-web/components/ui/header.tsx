import Link from "next/link";
import React from "react";
import { Button } from "./button";
import { ArrowLeft, Plus } from "lucide-react";

interface HeaderProps {
  title: string;
  description?: string;
  link?: string;
  linkLabel?: string;
  showButton?: boolean;
  buttonLabel?: string;
  buttonIcon?: React.ReactNode;
  buttonAction?: () => void;
  buttonVariant?:
    | "default"
    | "outline"
    | "ghost"
    | "link"
    | "destructive"
    | "secondary";
  actions?: React.ReactNode;
}

const Header = ({
  title,
  description,
  link = "/dashboard",
  linkLabel = "Volver al Dashboard",
  showButton = false,
  buttonLabel = "Nuevo",
  buttonIcon,
  buttonAction = () => {},
  buttonVariant = "default",
  actions,
}: HeaderProps) => {
  return (
    <div className="flex items-center gap-4 mb-6">
      <div className="w-full">
        <Link href={link}>
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {linkLabel}
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">{title}</h1>
        { description && <p className="text-muted-foreground">{description}</p> }
      </div>
      {showButton && (
        <Button onClick={buttonAction} variant={buttonVariant || "default"}>
          {buttonIcon}
          {buttonLabel}
        </Button>
      )}
      {actions && actions}
    </div>
  );
};

export default Header;
