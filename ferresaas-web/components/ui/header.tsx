import Link from "next/link";
import React from "react";
import { Button } from "./button";
import { ArrowLeft } from "lucide-react";

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
  linkLabel = "Volver al inicio",
  showButton = false,
  buttonLabel = "Nuevo",
  buttonIcon,
  buttonAction = () => {},
  buttonVariant = "default",
  actions,
}: HeaderProps) => {
  return (
    <>
      <Link href={link}>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 mb-4 h-10 px-3 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {linkLabel}
        </Button>
      </Link>
      <div className="app-panel app-orbit mb-6 flex flex-col gap-5 p-6 sm:p-7 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-semibold text-foreground md:text-4xl">
            {title}
          </h1>
          {description && (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
              {description}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 lg:justify-end">
          {actions && actions}
          {showButton && (
            <Button onClick={buttonAction} variant={buttonVariant || "default"}>
              {buttonIcon}
              {buttonLabel}
            </Button>
          )}
        </div>
      </div>
    </>
  );
};

export default Header;
