import { useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PixelPal } from "./PixelPal";
import {
  createFamily,
  checkResetEmail,
  joinFamily,
  signIn,
  signUp,
  resetPassword,
} from "../data/api";
import type { Database } from "../domain/model";

export function Brand() {
  return (
    <div className="flex items-center gap-2.5 text-(--color-ink)">
      <img
        src={`${import.meta.env.BASE_URL}kebnoi-logo-concept.png`}
        alt=""
        className="size-12 shrink-0 object-contain"
      />
      <div>
        <strong className="block font-(family-name:--font-display) text-[21px] font-bold leading-[1.15]">
          เก็บหน่อย
        </strong>
        <small className="mt-1 block font-(family-name:--font-body) text-[11px] leading-[1.15] font-medium text-(--color-muted)">
          เรื่องเงินของบ้านเรา
        </small>
      </div>
    </div>
  );
}
type Props = {
  db: Database;
  update: (db: Database) => void;
  reload: () => Promise<void>;
  busy: (value: boolean) => void;
  logout: () => void;
  bootstrapError?: string;
};

export function Auth({ update, bootstrapError = "" }: Props) {
  const [mode, setMode] = useState<"login" | "signup" | "forgot" | "reset">(
    "login",
  );
  const [resetEmail, setResetEmail] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  function change(next: typeof mode) {
    setMode(next);
    setError("");
    setNotice("");
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setNotice("");
    setIsBusy(true);
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email")).trim().toLowerCase();
    const password = String(data.get("password") || "");
    try {
      if (mode === "forgot") {
        await checkResetEmail(email);
        setResetEmail(email);
        setMode("reset");
        return;
      }
      if (mode === "reset") {
        if (password !== data.get("confirm"))
          throw new Error("รหัสผ่านยืนยันไม่ตรงกัน");
        if (new TextEncoder().encode(password).length > 72)
          throw new Error("รหัสผ่านต้องมีความยาวไม่เกิน 72 ไบต์");
        await resetPassword(resetEmail, password);
        setMode("login");
        setNotice(
          "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่",
        );
        return;
      }
      if (mode === "login") {
        update(await signIn(email, password));
        return;
      }
      const name = String(data.get("name")).trim();
      if (!name) throw new Error("กรุณากรอกชื่อผู้ใช้");
      if (password.length < 6)
        throw new Error("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      if (password !== data.get("confirm"))
        throw new Error("รหัสผ่านยืนยันไม่ตรงกัน");
      update(await signUp(name, email, password));
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "ดำเนินการไม่สำเร็จ";
      if (mode === "signup") console.error("[auth] signup failed:", cause);
      setError(
        mode === "signup" ? `สมัครสมาชิกไม่สำเร็จ: ${message}` : message,
      );
    } finally {
      setIsBusy(false);
    }
  }
  return (
    <div className="grid min-h-screen grid-cols-2 bg-white max-[768px]:grid-cols-1">
      <div className="relative flex min-h-screen flex-col overflow-hidden bg-(--color-blue-light) px-[45px] py-[35px] max-[768px]:hidden">
        <Brand />
        <div className="relative mx-auto mt-auto mb-5 h-[280px] w-[310px] [&_.pixel-pal]:absolute [&_.pixel-pal]:top-[55px] [&_.pixel-pal]:left-20 [&_.pixel-pal]:scale-150">
          <span className="absolute top-[50px] left-[30px] text-[35px] text-(--color-blue)">
            ✦
          </span>
          <span className="absolute top-[25px] right-5 text-[35px] text-(--color-blue)">
            ✳
          </span>
          <PixelPal />
          <div className="absolute bottom-[35px] left-[6px] grid size-12 -rotate-12 place-items-center border-4 border-(--color-blue-dark) bg-white font-(family-name:--font-display) text-2xl font-bold text-(--color-blue-dark)">
            ฿
          </div>
          <div className="absolute right-0 bottom-[70px] grid size-12 rotate-12 place-items-center border-4 border-(--color-blue-dark) bg-white font-(family-name:--font-display) text-2xl font-bold text-(--color-blue-dark)">
            ✦
          </div>
        </div>
        <div className="text-center [&_h1]:mt-[13px] [&_h1]:font-(family-name:--font-display) [&_h1]:text-4xl [&_h1]:leading-[1.35] [&_h1]:font-bold [&_h1]:text-(--color-blue-dark) [&_p]:mt-2.5 [&_p]:text-[13px] [&_p]:text-(--color-ink-soft)">
          <span className="eyebrow block text-xs font-semibold text-(--color-blue) light">
            YOUR LITTLE SAVING CLUB
          </span>
          <h1>
            เรื่องเงินของบ้าน
            <br />
            สนุกขึ้นอีกนิด ✨
          </h1>
          <p>บันทึกไปด้วยกัน เก็บทุกความฝันไปด้วยกัน</p>
        </div>
        <div className="mt-auto pt-10 font-(family-name:--font-number) text-[9px] font-bold tracking-[0.15em] text-(--color-blue) [&_span]:float-right">
          บันทึกง่าย เข้าใจเงินของบ้าน <span>✦</span>
        </div>
      </div>
      <div className="grid place-items-center p-10 max-[768px]:min-h-screen max-[768px]:px-6 max-[768px]:py-[30px]">
        <div className="hidden max-[768px]:absolute max-[768px]:top-6 max-[768px]:left-6 max-[768px]:block">
          <Brand />
        </div>
        <div className="w-full max-w-[390px] max-[768px]:pt-[55px] [&>h2]:mt-2.5 [&>h2]:font-(family-name:--font-display) [&>h2]:text-[28px] [&>h2]:font-bold [&>p]:mt-[7px] [&>p]:mb-[25px] [&>p]:text-sm [&>p]:text-(--color-muted)">
          <span className="eyebrow block text-xs font-semibold text-(--color-blue)">
            เริ่มต้นกับเก็บหน่อย
          </span>
          <h2>
            {mode === "login"
              ? "ยินดีต้อนรับกลับมา"
              : mode === "signup"
                ? "มาเป็นเพื่อนกัน!"
                : mode === "reset"
                  ? "ตั้งรหัสผ่านใหม่"
                  : "ลืมรหัสผ่าน?"}
          </h2>
          <p>
            {mode === "login"
              ? "เข้าสู่ระบบ แล้วมาดูเงินของเรากัน"
              : mode === "signup"
                ? "เริ่มต้นเก็บเรื่องเงินดี ๆ ไปด้วยกัน"
                : mode === "reset"
                  ? `ตั้งรหัสผ่านใหม่สำหรับ ${resetEmail}`
                  : "กรอกอีเมลที่ใช้สมัครเพื่อตั้งรหัสผ่านใหม่"}
          </p>
          {bootstrapError && mode === "login" && (
            <p
              className="form-error !text-[11px] !text-(--color-red)"
              role="alert"
            >
              {bootstrapError}
            </p>
          )}
          <form
            onSubmit={submit}
            className="form-stack flex flex-col gap-4 [&_label]:flex [&_label]:flex-col [&_label]:gap-[7px] [&_label]:text-sm [&_label]:font-bold [&_label]:text-(--color-ink) [&_input:not([type=hidden])]:min-h-[46px] [&_input:not([type=hidden])]:bg-white [&_input:not([type=hidden])]:text-base [&_.primary-button]:w-full"
          >
            {mode === "signup" && (
              <label>
                ชื่อผู้ใช้
                <Input
                  name="name"
                  placeholder="ชื่อเล่นของคุณ"
                  required
                  maxLength={40}
                />
              </label>
            )}
            {mode !== "reset" && (
              <label>
                อีเมล
                <Input
                  name="email"
                  type="email"
                  placeholder="hello@example.com"
                  required
                />
              </label>
            )}
            {mode !== "forgot" && (
              <label>
                รหัสผ่าน
                <Input
                  name="password"
                  type="password"
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                  required
                  minLength={6}
                  maxLength={72}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                />
              </label>
            )}
            {(mode === "signup" || mode === "reset") && (
              <label>
                ยืนยันรหัสผ่าน
                <Input
                  name="confirm"
                  type="password"
                  placeholder="กรอกรหัสผ่านอีกครั้ง"
                  required
                  minLength={6}
                  maxLength={72}
                  autoComplete="new-password"
                />
              </label>
            )}
            {mode === "login" && (
              <button
                className="text-link bg-transparent p-0 text-[11px] font-bold text-(--color-blue) align-right self-end"
                type="button"
                onClick={() => change("forgot")}
              >
                ลืมรหัสผ่าน?
              </button>
            )}
            {error && (
              <p
                className="form-error !text-[11px] !text-(--color-red)"
                role="alert"
              >
                {error}
              </p>
            )}
            {notice && (
              <p
                className="form-notice !text-[11px] !text-(--color-income)"
                role="status"
              >
                {notice}
              </p>
            )}
            <Button
              className="primary-button min-h-[46px] gap-2 rounded-xl bg-(--color-blue) px-[18px] text-sm font-bold text-white hover:bg-(--color-blue-dark)"
              type="submit"
              disabled={isBusy}
            >
              {mode === "login"
                ? "เข้าสู่ระบบ"
                : mode === "signup"
                  ? "สร้างบัญชี"
                  : mode === "reset"
                    ? "บันทึกรหัสผ่านใหม่"
                    : "ตรวจสอบอีเมล"}{" "}
              <ArrowRight data-icon="inline-end" />
            </Button>
          </form>
          <p className="!my-[22px] text-center">
            {mode === "login" ? "ยังไม่มีบัญชี?" : "มีบัญชีอยู่แล้ว?"}{" "}
            <button
              className="text-link bg-transparent p-0 text-[11px] font-bold text-(--color-blue)"
              onClick={() => change(mode === "login" ? "signup" : "login")}
            >
              {mode === "login" ? "สมัครสมาชิก" : "เข้าสู่ระบบ"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export function FamilySetup({ db, reload, busy, logout }: Props) {
  const [mode, setMode] = useState<"create" | "join">("create");
  const [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    busy(true);
    const form = new FormData(e.currentTarget);
    try {
      if (mode === "create")
        await createFamily(String(form.get("name")).trim());
      else await joinFamily(String(form.get("code")));
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ดำเนินการไม่สำเร็จ");
    } finally {
      busy(false);
    }
  }
  return (
    <div className="min-h-screen bg-(--color-blue-pale) p-[30px]">
      <Brand />
      <div className="mx-auto my-[50px] max-w-[460px] rounded-(--radius-card) border border-(--color-line) bg-white p-8">
        <div className="-my-5 flex justify-center [&_.pixel-pal]:scale-55">
          <PixelPal small />
        </div>
        <span className="eyebrow block text-xs font-semibold text-(--color-blue)">
          LET'S GET STARTED
        </span>
        <h1 className="mt-2 font-(family-name:--font-display) text-[25px] font-bold">
          บ้านของเราชื่ออะไรดี?
        </h1>
        <p className="mt-2 mb-5 text-xs text-(--color-muted)">
          สร้างครอบครัวใหม่ หรือใช้รหัส 4 หลักเพื่อเข้าร่วมบ้านที่มีอยู่แล้ว
        </p>
        <div className="segmented flex gap-[3px] rounded-[9px] border border-(--color-line) bg-white p-1 [&_button]:min-h-10 [&_button]:flex-1 [&_button]:rounded-md [&_button]:bg-transparent [&_button]:px-[13px] [&_button]:py-2 [&_button]:text-[13px] [&_button]:font-bold [&_button]:whitespace-nowrap [&_button]:text-(--color-muted) [&_button.active]:bg-(--color-blue-pale) [&_button.active]:text-(--color-blue) mb-5">
          <button
            className={mode === "create" ? "active" : ""}
            onClick={() => {
              setMode("create");
              setError("");
            }}
          >
            สร้างครอบครัว
          </button>
          <button
            className={mode === "join" ? "active" : ""}
            onClick={() => {
              setMode("join");
              setError("");
            }}
          >
            เข้าร่วมครอบครัว
          </button>
        </div>
        <form
          onSubmit={submit}
          className="form-stack flex flex-col gap-4 [&_label]:flex [&_label]:flex-col [&_label]:gap-[7px] [&_label]:text-sm [&_label]:font-bold [&_label]:text-(--color-ink) [&_input:not([type=hidden])]:min-h-[46px] [&_input:not([type=hidden])]:bg-white [&_input:not([type=hidden])]:text-base [&_.primary-button]:w-full"
        >
          {mode === "create" ? (
            <label>
              ชื่อครอบครัว
              <Input
                name="name"
                placeholder="เช่น บ้านเก็บเก่ง"
                required
                maxLength={80}
              />
            </label>
          ) : (
            <label>
              รหัสครอบครัว
              <Input
                name="code"
                placeholder="รหัส 4 หลัก"
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength={4}
                required
              />
            </label>
          )}
          {error && (
            <p
              role="alert"
              className="form-error !text-[11px] !text-(--color-red)"
            >
              {error}
            </p>
          )}
          <Button
            type="submit"
            className="primary-button min-h-[46px] gap-2 rounded-xl bg-(--color-blue) px-[18px] text-sm font-bold text-white hover:bg-(--color-blue-dark)"
            disabled={db.loading}
          >
            เริ่มต้นใช้งาน <ArrowRight data-icon="inline-end" />
          </Button>
        </form>
        <button
          className="text-link bg-transparent p-0 text-[11px] font-bold text-(--color-blue) mx-auto mt-5 block"
          onClick={logout}
        >
          ออกจากระบบ
        </button>
      </div>
    </div>
  );
}
