import LikeButton from "@/components/LikeButton";
import EnrollForm from "@/components/EnrollForm";
import { getCourse } from "@/lib/courses";
import Link from "next/link";
import { notFound } from "next/navigation";

type CoursePageProps = {
  params: Promise<{ id: string }>;
};

export default async function CoursePage({ params }: CoursePageProps) {
  const { id } = await params;
  const course = await getCourse(id);

  if (!course) {
    notFound();
  }

  return (
    <article className="max-w-3xl">
      <Link href="/courses" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">← Back to courses</Link>
      <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">{course.isElective ? "Elective course" : "Core course"}</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950 dark:text-white">{course.title}</h1>
        </div>
        <LikeButton courseId={course.id} initialLikes={course.likes} />
      </div>
      <p className="mt-8 text-xl leading-8 text-slate-600 dark:text-slate-300">{course.description}</p>
      <p className="mt-6 font-medium text-slate-700 dark:text-slate-300">{course.credits} credits</p>
      <div className="mt-8">
        <h2 className="mb-3 text-xl font-semibold">Enroll in this course</h2>
        <EnrollForm courseId={course.id} />
      </div>
    </article>
  );
}
