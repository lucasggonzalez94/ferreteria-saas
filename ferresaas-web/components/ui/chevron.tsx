import React from 'react';
import Link from 'next/link';
import { Button } from './button';
import { ArrowLeft } from 'lucide-react';

interface ChevronProps {
  link: string;
  linkLabel?: string;
}

const Chevron = ({link, linkLabel = 'Volver'}: ChevronProps) => {
  return (
    <Link href={link}>
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 mb-0 px-3 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {linkLabel}
      </Button>
    </Link>
  );
};

export default Chevron;
