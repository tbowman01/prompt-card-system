import * as React from "react";

interface BadgeProps {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  className?: string;
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ 
  variant = 'default', 
  className = "", 
  children 
}) => {
  const baseClasses = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium";
  
  const variantClasses = {
    default: "bg-blue-100 text-blue-800",
    secondary: "bg-yellow-100 text-yellow-800", 
    destructive: "bg-red-100 text-red-800",
    outline: "border border-gray-200 text-gray-700"
  };

  return (
    <span className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
};