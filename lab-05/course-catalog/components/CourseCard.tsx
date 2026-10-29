import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type CourseCardProps = {
  id: string;
  title: string;
  description: string;
  credits: number;
  likes: number;
};

export default function CourseCard({ id, title, description, credits, likes }: CourseCardProps) {
  return (
    <Link href={`/courses/${id}`}>
      <Card className="h-full border-slate-200 bg-white transition hover:border-blue-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-500">
        <CardHeader>
          <CardTitle className="text-lg text-slate-950 dark:text-slate-100">{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="leading-7 text-slate-600 dark:text-slate-300">{description}</p>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-indigo-700 dark:text-indigo-400">{credits} credits</span>
            <Button variant="ghost" size="sm" className="dark:text-slate-300 dark:hover:bg-slate-800">❤ {likes}</Button>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
