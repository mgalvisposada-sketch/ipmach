'use client';

interface ScrollToTopButtonProps {
  children: React.ReactNode;
  className?: string;
}

export function ScrollToTopButton({ children, className = '' }: ScrollToTopButtonProps) {
  return (
    <button
      onClick={() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }}
      className={className}
    >
      {children}
    </button>
  );
}

interface OpenAIWidgetButtonProps {
  children: React.ReactNode;
  className?: string;
}

export function OpenAIWidgetButton({ children, className = '' }: OpenAIWidgetButtonProps) {
  return (
    <button
      onClick={() => {
        const event = new CustomEvent('openAIWidget');
        window.dispatchEvent(event);
      }}
      className={className}
    >
      {children}
    </button>
  );
}
