import { useState, type FormEvent } from "react";
import { ArrowRight, CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PixelPal } from "./PixelPal";
import {
  createFamily,
  joinFamily,
  resetPassword,
  resendConfirmation,
  signIn,
  signUp,
} from "../data/api";
import type { Database } from "../domain/model";

export function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark">฿</div>
      <div>
        <strong>เก็บหน่อย</strong>
        <small>เรื่องเงินของบ้านเรา</small>
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

export function Auth({ db, update, busy, bootstrapError = "" }: Props) {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  function change(next: typeof mode) {
    setMode(next);
    setError("");
    setNotice("");
    setVerificationEmail("");
  }
  async function resendVerification() {
    setError("");
    setNotice("");
    busy(true);
    try {
      await resendConfirmation(verificationEmail);
      setNotice(
        "ส่งอีเมลยืนยันอีกครั้งแล้ว กรุณาตรวจกล่องจดหมายและโฟลเดอร์สแปม",
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "ส่งอีเมลยืนยันไม่สำเร็จ",
      );
    } finally {
      busy(false);
    }
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setNotice("");
    busy(true);
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email")).trim().toLowerCase();
    const password = String(data.get("password") || "");
    try {
      if (mode === "forgot") {
        await resetPassword(email);
        setNotice("ส่งลิงก์กู้รหัสผ่านไปยังอีเมลแล้ว");
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
      const result = await signUp(name, email, password);
      if (result) update(result);
      else setNotice("สมัครสมาชิกแล้ว กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ");
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "ดำเนินการไม่สำเร็จ";
      if (
        mode === "login" &&
        /email not confirmed|email_not_confirmed/i.test(message)
      ) {
        setVerificationEmail(email);
        setNotice(
          "บัญชีนี้ยังไม่ได้ยืนยันอีเมล กรุณายืนยันจากอีเมลที่ส่งให้ตอนสมัครก่อนเข้าสู่ระบบ",
        );
      } else setError(message);
    } finally {
      busy(false);
    }
  }
  return (
    <div className="auth-shell">
      <div className="auth-art">
        <Brand />
        <div className="auth-illustration">
          <span className="sparkle one">✦</span>
          <span className="sparkle two">✳</span>
          <PixelPal />
          <div className="coin coin-one">฿</div>
          <div className="coin coin-two">✦</div>
        </div>
        <div className="auth-copy">
          <span className="eyebrow light">YOUR LITTLE SAVING CLUB</span>
          <h1>
            เรื่องเงินของบ้าน
            <br />
            สนุกขึ้นอีกนิด ✨
          </h1>
          <p>บันทึกไปด้วยกัน เก็บทุกความฝันไปด้วยกัน</p>
        </div>
        <div className="auth-bottom">
          บันทึกง่าย เข้าใจเงินของบ้าน <span>✦</span>
        </div>
      </div>
      <div className="auth-main">
        <div className="auth-mobile-brand">
          <Brand />
        </div>
        <div className="auth-form">
          <span className="eyebrow">เริ่มต้นกับเก็บหน่อย</span>
          <h2>
            {mode === "login"
              ? "ยินดีต้อนรับกลับมา"
              : mode === "signup"
                ? "มาเป็นเพื่อนกัน!"
                : "ลืมรหัสผ่าน?"}
          </h2>
          <p>
            {mode === "login"
              ? "เข้าสู่ระบบ แล้วมาดูเงินของเรากัน"
              : mode === "signup"
                ? "เริ่มต้นเก็บเรื่องเงินดี ๆ ไปด้วยกัน"
                : "กรอกอีเมลเพื่อรับลิงก์กู้รหัสผ่าน"}
          </p>
          {bootstrapError && mode === "login" && (
            <p className="form-error" role="alert">
              {bootstrapError}
            </p>
          )}
          <form onSubmit={submit} className="form-stack">
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
            <label>
              อีเมล
              <Input
                name="email"
                type="email"
                placeholder="hello@example.com"
                required
              />
            </label>
            {mode !== "forgot" && (
              <label>
                รหัสผ่าน
                <Input
                  name="password"
                  type="password"
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                  required
                  minLength={6}
                />
              </label>
            )}
            {mode === "signup" && (
              <label>
                ยืนยันรหัสผ่าน
                <Input
                  name="confirm"
                  type="password"
                  placeholder="กรอกรหัสผ่านอีกครั้ง"
                  required
                  minLength={6}
                />
              </label>
            )}
            {mode === "login" && (
              <button
                className="text-link align-right"
                type="button"
                onClick={() => change("forgot")}
              >
                ลืมรหัสผ่าน?
              </button>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="form-notice" role="status">
                {notice}
              </p>
            )}
            {verificationEmail && (
              <button
                className="text-link"
                type="button"
                disabled={db.loading}
                onClick={() => void resendVerification()}
              >
                ส่งอีเมลยืนยันอีกครั้ง
              </button>
            )}
            <Button
              className="primary-button"
              type="submit"
              disabled={db.loading}
            >
              {mode === "login"
                ? "เข้าสู่ระบบ"
                : mode === "signup"
                  ? "สร้างบัญชี"
                  : "ส่งลิงก์กู้รหัสผ่าน"}{" "}
              <ArrowRight data-icon="inline-end" />
            </Button>
          </form>
          <p className="auth-switch">
            {mode === "login" ? "ยังไม่มีบัญชี?" : "มีบัญชีอยู่แล้ว?"}{" "}
            <button
              className="text-link"
              onClick={() => change(mode === "login" ? "signup" : "login")}
            >
              {mode === "login" ? "สมัครสมาชิก" : "เข้าสู่ระบบ"}
            </button>
          </p>
          <div className="mock-note">
            <CircleHelp size={15} /> ใช้ Supabase Auth
            และบันทึกข้อมูลไว้ในฐานข้อมูลของครอบครัว
          </div>
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
    <div className="setup-screen">
      <Brand />
      <div className="setup-card">
        <PixelPal small />
        <span className="eyebrow">LET'S GET STARTED</span>
        <h1>บ้านของเราชื่ออะไรดี?</h1>
        <p>
          สร้างครอบครัวใหม่ หรือใช้รหัส 4 หลักเพื่อเข้าร่วมบ้านที่มีอยู่แล้ว
        </p>
        <div className="segmented">
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
        <form onSubmit={submit} className="form-stack">
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
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <Button
            type="submit"
            className="primary-button"
            disabled={db.loading}
          >
            เริ่มต้นใช้งาน <ArrowRight data-icon="inline-end" />
          </Button>
        </form>
        <button className="text-link setup-logout" onClick={logout}>
          ออกจากระบบ
        </button>
      </div>
    </div>
  );
}
