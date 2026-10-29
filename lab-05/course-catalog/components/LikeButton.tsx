"use client";

import { useState } from "react";
import type { Course } from "@/lib/courses";

type LikeButtonProps = {
  courseId: string;
  initialLikes: number;
};

const API = process.env.NEXT_PUBLIC_API_URL;

export default function LikeButton({ courseId, initialLikes }: LikeButtonProps) {
  const [likes, setLikes] = useState<number>(initialLikes);
  const [failed, setFailed] = useState(false);

  async function handleClick() {
    setFailed(false);
    try {
      const res = await fetch(`${API}/courses/${courseId}/like`, { method: "POST" });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const course: Course = await res.json();
      setLikes(course.likes);
    } catch {
      setFailed(true);
    }
  }

  return (
    <div>
      <button type="button" onClick={handleClick} className="rounded-lg bg-rose-50 px-5 py-3 font-semibold text-rose-600 transition-colors hover:bg-rose-100">
        ❤ {likes}
      </button>
      {failed && <p className="text-red-600">Failed to like the course</p>}
    </div>
  );
}
