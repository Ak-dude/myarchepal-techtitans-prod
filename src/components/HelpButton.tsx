import { useState } from "react";
import { HelpCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const HelpButton = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating help button — bottom-right, above mobile nav */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Help"
        className="fixed bottom-24 right-4 lg:bottom-6 lg:right-6 z-50 w-11 h-11 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 active:scale-95 transition-all duration-200 flex items-center justify-center"
      >
        <HelpCircle className="w-5 h-5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl w-[95vw] p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-4 py-3 border-b border-border flex-shrink-0">
            <DialogTitle className="text-base font-semibold">ArchePal — The future of the past is in our hands!</DialogTitle>
          </DialogHeader>
          <div className="relative w-full aspect-video">
            <iframe
              src="https://www.youtube.com/embed/2jiy1DVv8mw"
              title="ArchePal- The future of the past is in our hands!"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
