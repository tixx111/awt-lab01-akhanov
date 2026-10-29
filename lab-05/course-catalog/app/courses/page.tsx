import CourseCard from "@/components/CourseCard";
import { getCourses } from "@/lib/courses";

export default async function CoursesPage() {
  const courses = await getCourses();
// sm:640 lg:1024 xl:1280
  return (
    <section>
      <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">Course catalog</p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950 dark:text-white">Find your next course</h1>
      <p className="mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-300">Choose a course to explore its details and add your local like.</p>
      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {courses.map((course) => (
          <CourseCard key={course.id} id={course.id} title={course.title} description={course.description} credits={course.credits} likes={course.likes} />
        ))}
      </div>
    </section>
  );
}
