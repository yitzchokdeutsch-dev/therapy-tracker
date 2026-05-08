"use client";

import type { ReactNode } from "react";

interface ModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
}

export default function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  maxWidth = "max-w-md",
}: ModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-xl p-6 w-full ${maxWidth} mx-4`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-lg">{title}</h3>
            {subtitle && <div className="text-sm text-ink-500 mt-0.5">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600 text-xl leading-none">
            &times;
          </button>
        </div>
        <div>{children}</div>
        {footer && <div className="mt-5">{footer}</div>}
      </div>
    </div>
  );
}
