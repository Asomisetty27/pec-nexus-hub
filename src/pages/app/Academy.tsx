import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { GraduationCap, BookOpen, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.2 } } };

export default function Academy() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<any[]>([]);
  const [progress, setProgress] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [coursesRes, progressRes] = await Promise.all([
        supabase.from("courses").select("*, lessons(id)").order("created_at"),
        supabase.from("course_progress").select("*").eq("user_id", user.id),
      ]);
      setCourses(coursesRes.data || []);
      setProgress(progressRes.data || []);
      setLoading(false);
    };
    load();
  }, [user]);

  const getProgress = (courseId: string) => progress.find(p => p.course_id === courseId);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map(i => <Card key={i} className="h-32 animate-pulse bg-muted/30" />)}
      </div>
    );
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-4xl">
      <motion.div variants={item}>
        <h1 className="font-display text-2xl font-bold">Training Academy</h1>
        <p className="text-xs text-muted-foreground font-mono mt-1">{courses.length} courses available</p>
      </motion.div>

      {courses.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16">
          <GraduationCap className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No courses available yet.</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {courses.map((course: any) => {
            const cp = getProgress(course.id);
            const lessonCount = course.lessons?.length || 0;
            const completedLessons = cp?.completed_lessons?.length || 0;
            const pct = lessonCount > 0 ? (completedLessons / lessonCount) * 100 : 0;

            return (
              <motion.div key={course.id} variants={item}>
                <Card className="hover:border-accent/40 transition-all cursor-pointer group" onClick={() => {}}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <ProgressRing progress={pct} size={56} strokeWidth={4}>
                      <BookOpen className="h-4 w-4 text-accent" />
                    </ProgressRing>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold">{course.title}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-1">{course.description || "No description"}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-mono text-muted-foreground">{lessonCount} lessons</span>
                        {course.is_required && <Badge variant="outline" className="text-[9px] font-mono">Required</Badge>}
                        {cp?.completed && <Badge className="text-[9px]">Certified</Badge>}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors shrink-0" />
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
