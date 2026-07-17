import React from 'react';
import { Link } from 'react-router-dom';

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
  // Opt-in only — pages with a long form (Register, Complete Profile)
  // pass their primary submit button here instead of leaving it at the
  // bottom of `children`. On a real phone with the on-screen keyboard
  // open, a button buried below several form fields can end up below
  // the visible viewport entirely — scrolling past it isn't obvious,
  // so it reads as "there's no button, just text" even though one
  // exists. Pinning it here keeps it reachable at all times without
  // changing anything for every other page that doesn't pass this prop.
  stickyAction?: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ title, subtitle, children, footer, maxWidth = 'max-w-sm', stickyAction }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-purple-500 to-blue-500 flex items-center justify-center p-4">
      <div className={`w-full ${maxWidth}`}>
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white shadow-xl mb-4 p-1.5">
            <img src="/icon-512.png" alt="Memory Drop" className="w-full h-full rounded-2xl object-cover" />
          </Link>
          <h1 className="text-3xl font-bold text-white">{title}</h1>
          {subtitle && <p className="text-purple-200 text-sm mt-1">{subtitle}</p>}
        </div>

        <div className={`bg-white rounded-3xl shadow-2xl p-6 ${stickyAction ? 'max-h-[80vh] flex flex-col' : ''}`}>
          <div className={stickyAction ? 'overflow-y-auto flex-1 -mx-1 px-1' : ''}>
            {children}
          </div>
          {stickyAction && (
            <div className="sticky bottom-0 -mx-6 -mb-6 px-6 pb-6 pt-4 mt-2 bg-white rounded-b-3xl border-t border-gray-100">
              {stickyAction}
            </div>
          )}
        </div>

        {footer && <div className="text-center text-purple-200 text-xs mt-6">{footer}</div>}
      </div>
    </div>
  );
};

export const AuthSpinner: React.FC = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#FAF3EC] via-purple-50 to-blue-50 gap-4">
    <img src="/icon-512.png" alt="Memory Drop" className="w-20 h-20 rounded-3xl shadow-xl animate-pulse" />
    <div className="w-6 h-6 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
  </div>
);
