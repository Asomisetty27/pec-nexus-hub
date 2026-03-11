import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);

  return (
    <div className="flex min-h-[80vh] items-center justify-center py-12">
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md px-4">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <span className="font-display text-xl font-bold text-primary-foreground">P</span>
            </div>
          </Link>
        </div>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="font-display text-2xl">{isSignUp ? "Create Account" : "Welcome Back"}</CardTitle>
            <CardDescription>
              {isSignUp
                ? "Sign up with your Cal Poly email (@calpoly.edu)"
                : "Sign in to your PEC Nexus account"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              {isSignUp && (
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input id="fullName" placeholder="Jane Smith" required />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="jsmith@calpoly.edu" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" placeholder="••••••••" required />
              </div>
              <Button type="submit" className="w-full">
                {isSignUp ? "Create Account" : "Sign In"}
              </Button>
            </form>
            <div className="mt-4 text-center text-sm text-muted-foreground">
              {isSignUp ? (
                <>Already have an account?{" "}<button onClick={() => setIsSignUp(false)} className="text-accent underline-offset-4 hover:underline">Sign in</button></>
              ) : (
                <>Don't have an account?{" "}<button onClick={() => setIsSignUp(true)} className="text-accent underline-offset-4 hover:underline">Sign up</button></>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
