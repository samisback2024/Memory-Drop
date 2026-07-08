import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, MailCheck } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { AuthLayout } from '../components/auth/AuthLayout';
import { validateEmail } from '../lib/validators';

export const ForgotPasswordPage: React.FC = () => {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const emailError = validateEmail(email);
    if (emailError) return setError(emailError);

    setLoading(true);
    const { error: resetError } = await sendPasswordReset(email);
    setLoading(false);

    // Show the same success state whether or not the address is registered,
    // so this form can't be used to enumerate accounts.
    if (resetError) {
      setError(resetError);
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <AuthLayout title="Check your email">
        <div className="flex flex-col items-center text-center gap-3 py-2">
          <div className="w-14 h-14 rounded-2xl bg-purple-50 flex items-center justify-center">
            <MailCheck size={26} className="text-purple-600" />
          </div>
          <p className="text-sm text-gray-600">
            If an account exists for <span className="font-medium text-gray-900">{email}</span>, we&apos;ve sent a
            link to reset your password.
          </p>
          <Link to="/login" className="mt-2">
            <Button variant="secondary" size="md">
              <ArrowLeft size={15} />
              Back to sign in
            </Button>
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Forgot password?" subtitle="We'll email you a reset link.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoComplete="email"
          leftIcon={<Mail size={16} />}
        />

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <Button type="submit" variant="primary" fullWidth loading={loading} size="lg">
          Send reset link
        </Button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-5">
        <Link to="/login" className="font-medium text-purple-600 hover:text-purple-700 inline-flex items-center gap-1">
          <ArrowLeft size={14} />
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
};
