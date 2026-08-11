function Button({ children, onClick, className }: { children: React.ReactNode; onClick: () => void; className?: string }) {
  return (
    <button
      className={`btn btn-primary ${className || ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default Button;
