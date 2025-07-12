import React from 'react';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  className?: string;
}

const Badge: React.FC<BadgeProps> = ({ children, className = '', ...props }) => (
  <span
    className={`inline-block px-3 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700 ${className}`}
    {...props}
  >
    {children}
  </span>
);

export default Badge; 