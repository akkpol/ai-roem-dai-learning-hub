"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BellSimple,
  BookmarkSimple,
  BookOpenText,
  Briefcase,
  CalendarBlank,
  CaretDown,
  Certificate,
  ChartBar,
  CheckCircle,
  Clock,
  GraduationCap,
  MagnifyingGlass,
  Play,
  Sparkle,
  VideoCamera,
} from "@phosphor-icons/react";
import {
  SiClaude,
  SiGithubcopilot,
  SiGoogle,
  SiGoogledocs,
  SiGoogledrive,
  SiGooglegemini,
  SiGooglesheets,
} from "react-icons/si";
import { TbBrandOpenai } from "react-icons/tb";
import {
  courses,
  fields,
  levels,
  tools,
  type Course,
  type CourseField,
  type CourseLevel,
  type CourseTool,
} from "@/lib/catalog";

type FilterState = {
  level: CourseLevel | null;
  tool: CourseTool | null;
  field: CourseField | null;
};

const navItems = [
  { label: "หน้าหลัก", href: "/" },
  { label: "สำรวจคอร์ส", href: "/#courses" },
  { label: "เส้นทางการเรียน", href: "/#beginner" },
  { label: "คลาสสด", href: "/courses/ai-fundamentals" },
  { label: "ใบประกาศ", href: "/account/certificates" },
];

const initialFilters: FilterState = {
  level: null,
  tool: null,
  field: null,
};

function BrandMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <BookOpenText weight="duotone" />
      <Sparkle weight="fill" />
    </div>
  );
}

function ToolIcon({ tool }: { tool: CourseTool }) {
  if (tool === "ChatGPT") {
    return <TbBrandOpenai aria-hidden="true" />;
  }
  if (tool === "Claude") {
    return <SiClaude aria-hidden="true" />;
  }
  if (tool === "Gemini") {
    return <SiGooglegemini aria-hidden="true" />;
  }
  if (tool === "Copilot") {
    return <SiGithubcopilot aria-hidden="true" />;
  }
  return <Sparkle weight="fill" aria-hidden="true" />;
}

function CourseCover({ course }: { course: Course }) {
  if (course.cover === "fundamentals") {
    return (
      <Image
        className="course-cover-image"
        src="/images/course-ai-fundamentals.webp"
        alt="ปกคอร์ส AI Fundamentals"
        width={184}
        height={88}
      />
    );
  }

  if (course.cover === "analytics") {
    return (
      <Image
        className="course-cover-image"
        src="/images/course-data-analysis.webp"
        alt="ปกคอร์สวิเคราะห์ข้อมูลด้วย AI"
        width={184}
        height={88}
      />
    );
  }

  if (course.cover === "chat-claude") {
    return (
      <div className="brand-course-cover chat-claude-cover" aria-hidden="true">
        <span>
          <TbBrandOpenai />
        </span>
        <span>
          <SiClaude />
        </span>
      </div>
    );
  }

  return (
    <div className="brand-course-cover google-cover" aria-hidden="true">
      <SiGoogle />
      <SiGoogledocs />
      <SiGooglesheets />
      <SiGoogledrive />
    </div>
  );
}

function FilterButton<T extends string>({
  value,
  active,
  recommended = false,
  onSelect,
  children,
}: {
  value: T;
  active: boolean;
  recommended?: boolean;
  onSelect: (value: T | null) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className="filter-chip"
      data-active={active}
      data-recommended={recommended}
      type="button"
      aria-pressed={active}
      onClick={() => onSelect(active ? null : value)}
    >
      {children}
    </button>
  );
}

export function CourseDiscovery() {
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [saved, setSaved] = useState(
    () => new Set(["ai-fundamentals", "gemini-workspace"]),
  );
  const [savedOnly, setSavedOnly] = useState(false);
  const [notice, setNotice] = useState("");
  const courseListRef = useRef<HTMLElement>(null);

  const visibleCourses = useMemo(() => {
    const normalized = submittedQuery.trim().toLocaleLowerCase("th");
    const isDefaultView =
      !filters.level && !filters.tool && !filters.field && !normalized && !savedOnly;

    const matches = courses.filter((course) => {
      const searchable = [
        course.title,
        course.level,
        ...course.tools,
        ...course.fields,
      ]
        .join(" ")
        .toLocaleLowerCase("th");

      return (
        (!filters.level || course.level === filters.level) &&
        (!filters.tool || course.tools.includes(filters.tool)) &&
        (!filters.field || course.fields.includes(filters.field)) &&
        (!normalized || searchable.includes(normalized)) &&
        (!savedOnly || saved.has(course.id))
      );
    });

    return isDefaultView ? matches.slice(0, 4) : matches;
  }, [filters, saved, savedOnly, submittedQuery]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedQuery(query);
    setNotice(query.trim() ? `กำลังแสดงผลสำหรับ “${query.trim()}”` : "แสดงคอร์สทั้งหมดแล้ว");
    courseListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function clearFilters() {
    setFilters({ level: null, tool: null, field: null });
    setQuery("");
    setSubmittedQuery("");
    setSavedOnly(false);
    setNotice("ล้างตัวกรองแล้ว");
  }

  function chooseBeginnerPath() {
    setFilters({ level: "เริ่มต้น", tool: null, field: null });
    setQuery("");
    setSubmittedQuery("");
    setSavedOnly(false);
    setNotice("เลือกเส้นทางสำหรับมือใหม่แล้ว");
    courseListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function toggleSaved(id: string) {
    setSaved((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
        setNotice("นำคอร์สออกจากรายการที่บันทึกแล้ว");
      } else {
        next.add(id);
        setNotice("บันทึกคอร์สไว้ในคอร์สของฉันแล้ว");
      }
      return next;
    });
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="AI เริ่มได้ หน้าหลัก">
          <BrandMark />
          <span>
            <strong>AI เริ่มได้</strong>
            <small>เรียน AI ให้ใช้ได้จริง</small>
          </span>
        </Link>

        <nav className="primary-nav" aria-label="เมนูหลัก">
          {navItems.map((item) => (
            <Link key={item.label} href={item.href} data-active={item.label === "สำรวจคอร์ส"}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="header-actions">
          <Link
            className="my-courses-button"
            href="/learn"
          >
            <GraduationCap weight="regular" />
            <span>คอร์สของฉัน</span>
            <b>{saved.size}</b>
          </Link>
          <button className="icon-button" type="button" aria-label="รายการที่บันทึก">
            <BookmarkSimple weight="regular" />
          </button>
          <button className="icon-button notification-button" type="button" aria-label="การแจ้งเตือน">
            <BellSimple weight="regular" />
          </button>
          <Link className="profile-button" href="/learn" aria-label="เปิดหน้าสมาชิก">
            <Image
              src="/images/avatar-kanyaporn.webp"
              alt="กาญจนา"
              width={46}
              height={46}
              priority
            />
            <span>กาญจนา</span>
            <CaretDown weight="bold" />
          </Link>
        </div>
      </header>

      <main id="main" className="main-content">
        <section className="discovery-hero" aria-labelledby="discovery-title">
          <div className="hero-copy">
            <h1 id="discovery-title">สำรวจคอร์ส AI ที่ใช่สำหรับคุณ</h1>
            <p>ค้นหาความรู้และทักษะที่ช่วยให้คุณทำงานได้ดีขึ้น ด้วยเครื่องมือ AI ที่เหมาะกับคุณ</p>
            <form className="search-form" onSubmit={submitSearch}>
              <MagnifyingGlass weight="regular" aria-hidden="true" />
              <label className="sr-only" htmlFor="course-search">
                ค้นหาคอร์ส AI
              </label>
              <input
                id="course-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="อยากใช้ AI ทำอะไร หรืออยากเรียนเครื่องมือไหน?"
              />
              <button type="submit">ค้นหาคอร์ส</button>
            </form>
          </div>
          <Image
            className="hero-image"
            src="/images/hero-still-life.webp"
            alt="โต๊ะเรียนรู้พร้อมกาแฟ หนังสือ และต้นไม้"
            width={590}
            height={220}
            priority
          />
        </section>

        <section className="filter-panel" aria-label="ตัวกรองคอร์ส">
          <div className="filter-group level-filter">
            <h2>
              <ChartBar weight="bold" /> ระดับ
            </h2>
            <div className="filter-options">
              {levels.map((level) => (
                <FilterButton
                  key={level}
                  value={level}
                  active={filters.level === level}
                  recommended={level === "เริ่มต้น" && filters.level === null}
                  onSelect={(value) => setFilters((current) => ({ ...current, level: value }))}
                >
                  {level === "เริ่มต้น" && <span className="active-dot" />}
                  {level}
                </FilterButton>
              ))}
            </div>
          </div>

          <div className="filter-group tool-filter">
            <h2>
              <Briefcase weight="bold" /> เครื่องมือ
            </h2>
            <div className="filter-options">
              {tools.map((tool) => (
                <FilterButton
                  key={tool}
                  value={tool}
                  active={filters.tool === tool}
                  onSelect={(value) => setFilters((current) => ({ ...current, tool: value }))}
                >
                  <span className={`tool-icon tool-${tool.replace(" ", "-").toLowerCase()}`}>
                    <ToolIcon tool={tool} />
                  </span>
                  {tool}
                  {tool === "อื่น ๆ" && <CaretDown weight="bold" />}
                </FilterButton>
              ))}
            </div>
          </div>

          <div className="filter-group field-filter">
            <h2>
              <Briefcase weight="bold" /> สายงาน
            </h2>
            <div className="filter-options">
              {fields.map((field) => (
                <FilterButton
                  key={field}
                  value={field}
                  active={filters.field === field}
                  onSelect={(value) => setFilters((current) => ({ ...current, field: value }))}
                >
                  {field}
                </FilterButton>
              ))}
            </div>
          </div>
        </section>

        <section id="beginner" className="beginner-path" aria-labelledby="beginner-title">
          <Image
            src="/images/beginner-path.webp"
            alt="สมุด AI Fundamentals พร้อมเช็กลิสต์"
            width={290}
            height={164}
          />
          <div className="beginner-copy">
            <h2 id="beginner-title">
              ไม่รู้จะเริ่มตรงไหน?
              <strong>เริ่มจาก AI Fundamentals</strong>
            </h2>
            <p>เส้นทางปูพื้นฐานที่จะช่วยให้คุณเข้าใจ AI อย่างเป็นระบบ และใช้งานได้อย่างมั่นใจ</p>
          </div>
          <ul>
            <li>
              <CheckCircle weight="fill" /> เข้าใจแนวคิดสำคัญของ AI แบบไม่ต้องมีพื้นฐาน
            </li>
            <li>
              <CheckCircle weight="fill" /> รู้เท่าทันการใช้งานและความเสี่ยงอย่างปลอดภัย
            </li>
            <li>
              <CheckCircle weight="fill" /> พร้อมต่อยอดสู่เครื่องมือและงานที่คุณสนใจ
            </li>
          </ul>
          <button type="button" onClick={chooseBeginnerPath}>
            ดูเส้นทางสำหรับมือใหม่ <ArrowRight weight="bold" />
          </button>
        </section>

        <section id="courses" className="course-section" ref={courseListRef} aria-labelledby="course-list-title">
          <div className="section-heading">
            <h2 id="course-list-title">
              {savedOnly ? "คอร์สของฉัน" : submittedQuery || filters.tool || filters.field ? "คอร์สที่ค้นพบ" : "คอร์สแนะนำสำหรับคุณ"}
            </h2>
            <button type="button" onClick={clearFilters}>
              ดูคอร์สทั้งหมด <ArrowRight weight="bold" />
            </button>
          </div>

          <p className="sr-only" aria-live="polite">
            {notice || `พบ ${visibleCourses.length} คอร์ส`}
          </p>

          <div className="course-list">
            {visibleCourses.length > 0 ? (
              visibleCourses.map((course) => (
                <article className="course-row" key={course.id}>
                  <CourseCover course={course} />
                  <div className="course-main">
                    <h3><Link href={`/courses/${course.id}`}>{course.title}</Link></h3>
                    <div className="course-meta">
                      <span className="level-badge">{course.level}</span>
                      <span>
                        {course.format === "คลาสสด" ? (
                          <GraduationCap weight="regular" />
                        ) : (
                          <VideoCamera weight="regular" />
                        )}
                        {course.format}
                      </span>
                      <span>
                        <Clock weight="regular" /> {course.duration}
                      </span>
                      <span className="instructor">
                        <Image src={course.avatar} alt="" width={28} height={28} />
                        {course.instructor}
                      </span>
                    </div>
                  </div>
                  <div className="course-availability">
                    <span>
                      {course.time ? <CalendarBlank weight="regular" /> : <Play weight="fill" />}
                      {course.availability}
                    </span>
                    {course.time && <small>{course.time}</small>}
                  </div>
                  <div className="certificate-status">
                    <Certificate weight="regular" />
                    <span>{course.certificate ? "มีใบประกาศ" : "ไม่มีใบประกาศ"}</span>
                  </div>
                  <button
                    className="save-button"
                    type="button"
                    data-active={saved.has(course.id)}
                    aria-pressed={saved.has(course.id)}
                    aria-label={`${saved.has(course.id) ? "ยกเลิกบันทึก" : "บันทึก"} ${course.title}`}
                    onClick={() => toggleSaved(course.id)}
                  >
                    <BookmarkSimple weight={saved.has(course.id) ? "fill" : "regular"} />
                  </button>
                </article>
              ))
            ) : (
              <div className="empty-state">
                <BookOpenText weight="duotone" />
                <div>
                  <h3>ยังไม่พบคอร์สที่ตรงกับตัวกรองนี้</h3>
                  <p>ลองเลือกเครื่องมือหรือระดับอื่น แล้วค้นหาอีกครั้ง</p>
                </div>
                <button type="button" onClick={clearFilters}>
                  ล้างตัวกรอง
                </button>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
