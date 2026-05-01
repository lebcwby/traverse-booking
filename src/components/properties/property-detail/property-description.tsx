"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface PropertyDescriptionProps {
  summary: string;
  space?: string;
  neighborhoodContext?: string;
}

export function PropertyDescription({
  summary,
  space,
  neighborhoodContext,
}: PropertyDescriptionProps) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <h2 className="mb-3 text-xl font-semibold">About this property</h2>
      <div className="line-clamp-4 whitespace-pre-line text-sm leading-relaxed text-foreground">
        <p>{summary}</p>
      </div>
      {neighborhoodContext && (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {neighborhoodContext}
        </p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="mt-4 rounded-full px-6">
            Show more
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>About this property</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
              {summary}
            </p>
            {neighborhoodContext && (
              <p className="text-sm leading-relaxed text-muted-foreground">
                {neighborhoodContext}
              </p>
            )}
            {space && (
              <>
                <h3 className="text-base font-semibold text-foreground">
                  The space
                </h3>
                <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
                  {space}
                </p>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
