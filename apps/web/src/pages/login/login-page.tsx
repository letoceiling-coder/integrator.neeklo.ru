import { useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { loginSchema, type LoginDto } from '@neeklo/contracts';
import { ApiRequestError } from '@/shared/api/client';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { useLogin } from '@/features/auth/session';

export function LoginPage() {
  const navigate = useNavigate();
  const login = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginDto>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: 'owner@neeklo.dev', password: 'neeklo12345' },
  });

  const onSubmit = handleSubmit(async (values) => {
    await login.mutateAsync(values);
    await navigate({ to: '/' });
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm"
      >
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary)] text-[var(--color-primary-fg)] font-semibold">
            N
          </div>
          <h1 className="text-lg font-semibold tracking-tight">NEEKLO Marketplace OS</h1>
          <p className="mt-1 text-sm text-[var(--color-fg-subtle)]">Войдите в операционную систему продаж</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3 rounded-[var(--radius-lg)] bg-[var(--color-surface)] p-6 hairline">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--color-fg-muted)]">Email</label>
            <Input type="email" autoComplete="email" {...register('email')} />
            {errors.email && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.email.message}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--color-fg-muted)]">Пароль</label>
            <Input type="password" autoComplete="current-password" {...register('password')} />
            {errors.password && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.password.message}</p>}
          </div>

          {login.error instanceof ApiRequestError && (
            <p className="text-xs text-[var(--color-danger)]">{login.error.body.message}</p>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={isSubmitting || login.isPending}>
            {login.isPending ? 'Вход…' : 'Войти'}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
