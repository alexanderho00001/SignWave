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

export default function RegisterPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        username: "",
        email: "",
        password: "",
        passwordConfirmation: "",
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

        // Validate password confirmation
        if (formData.password !== formData.passwordConfirmation) {
            setError("Passwords do not match");
            setLoading(false);
            return;
        }

        // Validate required fields
        if (!formData.firstName || !formData.lastName) {
            setError("First name and last name are required");
            setLoading(false);
            return;
        }

        try {
            const res = await fetch("/api/user", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    firstName: formData.firstName,
                    lastName: formData.lastName,
                    name: `${formData.firstName} ${formData.lastName}`,
                    username: formData.username,
                    email: formData.email,
                    password: formData.password,
                }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || data.detail || "Registration failed");
            }

            // after successful signup, send them back to login
            router.push("/");
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
                        Create your SignWave account
                    </CardTitle>
                    <CardDescription>
                        Start learning ASL with interactive lessons.
                    </CardDescription>
                </CardHeader>

                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="firstName">First Name</Label>
                                <Input
                                    id="firstName"
                                    name="firstName"
                                    value={formData.firstName}
                                    onChange={handleChange}
                                    autoComplete="given-name"
                                    required
                                    disabled={loading}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="lastName">Last Name</Label>
                                <Input
                                    id="lastName"
                                    name="lastName"
                                    value={formData.lastName}
                                    onChange={handleChange}
                                    autoComplete="family-name"
                                    required
                                    disabled={loading}
                                />
                            </div>
                        </div>

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
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                value={formData.email}
                                onChange={handleChange}
                                autoComplete="email"
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
                                autoComplete="new-password"
                                required
                                disabled={loading}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="passwordConfirmation">Confirm Password</Label>
                            <Input
                                id="passwordConfirmation"
                                name="passwordConfirmation"
                                type="password"
                                value={formData.passwordConfirmation}
                                onChange={handleChange}
                                autoComplete="new-password"
                                required
                                disabled={loading}
                            />
                        </div>

                        <Button
                            type="submit"
                            className="w-full"
                            disabled={loading}
                        >
                            {loading ? "Signing up..." : "Sign up"}
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
                        Already have an account?{" "}
                        <Link
                            href="/"
                            className="font-medium text-primary underline-offset-4 hover:underline"
                        >
                            Log in
                        </Link>
                    </p>
                </CardFooter>
            </Card>
        </main>
    );
}
