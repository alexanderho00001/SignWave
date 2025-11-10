"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Check if user is already authenticated and redirect
  useEffect(() => {
    const checkAuth = () => {
      // Check localStorage for userId
      const userId = localStorage.getItem('userId');
      
      // Check cookie for user data (non-httpOnly cookie)
      const cookies = document.cookie.split(';');
      const userCookie = cookies.find(cookie => cookie.trim().startsWith('_signwave_user='));
      
      if (userId || userCookie) {
        // User is authenticated, redirect to dashboard
        router.push('/dashboard');
      } else {
        setCheckingAuth(false);
      }
    };

    checkAuth();
  }, [router]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || data.detail || "Login failed");
      }

      const data = await res.json();
      
      // Store user info in localStorage for easy access
      if (data.user) {
        localStorage.setItem('userId', data.user.id);
        localStorage.setItem('userName', data.user.name);
        localStorage.setItem('username', data.user.username);
      }

      // Redirect to dashboard after successful login
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // Show loading state while checking authentication
  if (checkingAuth) {
    return (
      <main className="flex min-h-screen w-full items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Checking authentication...</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-semibold">
            Welcome back to SignWave
          </CardTitle>
          <CardDescription>
            Log in to continue your ASL practice.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                autoComplete="username"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                autoComplete="current-password"
                required
                disabled={loading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Logging in..." : "Log in"}
            </Button>

            {error && (
              <p className="text-center text-sm text-destructive">
                {error}
              </p>
            )}
          </form>
        </CardContent>

        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link
              href="/register"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Register here
            </Link>
          </p>
        </CardFooter>
      </Card>
    </main>
  );
}
