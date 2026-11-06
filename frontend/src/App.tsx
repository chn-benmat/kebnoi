import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  Copy,
  House,
  LogOut,
  Pencil,
  Plus,
  ReceiptText,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  UserRound,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { th } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Auth, Brand, FamilySetup } from "./components/Auth";
import { PixelPal } from "./components/PixelPal";
import { Chart } from "./components/Chart";
import {
  assetURL,
  bootstrap,
  changePassword,
  createTransaction,
  deleteAccount,
  deleteTransaction,
  emptyDatabase,
  hasSession,
  restoreSession,
  leaveFamily as leaveFamilyApi,
  signOut,
  updateCredentials,
  updateProfile,
  updateTransaction,
  uploadProfileAvatar,
} from "./data/api";
import {
  inPeriod,
  localDate,
  money,
  spendingRanking,
  type Database,
  type Kind,
  type Period,
  type Transaction,
  type User,
} from "./domain/model";

type Page = "dashboard" | "transactions" | "family" | "profile" | "security";
type Confirmation =
  | { kind: "transaction"; transaction: Transaction }
  | { kind: "account" }
  | { kind: "leave" };
const dateText = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
function Avatar({ user, size = "" }: { user?: User; size?: string }) {
  return (
    <span
      className={`inline-grid shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white bg-(--color-blue-light) font-extrabold text-(--color-blue-dark) shadow-[0_0_0_1px_var(--color-line)] ${size === "large" ? "size-[72px] text-[27px]" : "size-[37px]"}`}
    >
      {user?.avatar ? (
        <img
          className="size-full object-cover"
          src={assetURL(user.avatar)}
          alt=""
        />
      ) : (
        user?.name.slice(0, 1) || "?"
      )}
    </span>
  );
}
function TransactionDialog({
  open,
  close,
  initial,
  save,
}: {
  open: boolean;
  close: () => void;
  initial?: Transaction;
  save: (
    value: Pick<Transaction, "kind" | "description" | "amount" | "date">,
  ) => void;
}) {
  const [kind, setKind] = useState<Kind>(initial?.kind || "expense");
  const [date, setDate] = useState(
    () => new Date(`${initial?.date || localDate()}T12:00:00`),
  );
  const [calendarOpen, setCalendarOpen] = useState(false);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const amount = Number(data.get("amount"));
    const description = String(data.get("description")).trim();
    if (!description || !Number.isFinite(amount) || amount <= 0) return;
    save({ kind, date: String(data.get("date")), description, amount });
    // Keep the dialog open if the save request fails.
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent className="app-dialog w-[calc(100%-32px)] max-w-[440px] p-[25px] [&_[data-slot=dialog-title]]:text-[21px] [&_[data-slot=dialog-title]]:font-bold [&_[data-slot=dialog-description]]:text-xs [&_[data-slot=dialog-description]]:text-(--color-ink-soft)">
        <DialogHeader>
          <DialogTitle>
            {initial ? "แก้ไขรายการ" : "เพิ่มรายการใหม่"}
          </DialogTitle>
          <DialogDescription>
            เก็บทุกเรื่องเงินเล็ก ๆ ของบ้านเราไว้ตรงนี้
          </DialogDescription>
        </DialogHeader>
        <form
          className="form-stack flex flex-col gap-4 [&_label]:flex [&_label]:flex-col [&_label]:gap-[7px] [&_label]:text-sm [&_label]:font-bold [&_label]:text-(--color-ink) [&_input:not([type=hidden])]:min-h-[46px] [&_input:not([type=hidden])]:bg-white [&_input:not([type=hidden])]:text-base [&_.primary-button]:w-full"
          onSubmit={submit}
          key={initial?.id || "new"}
        >
          <div
            className="segmented flex gap-[3px] rounded-[9px] border border-(--color-line) bg-white p-1 [&_button]:min-h-10 [&_button]:flex-1 [&_button]:rounded-md [&_button]:bg-transparent [&_button]:px-[13px] [&_button]:py-2 [&_button]:text-[13px] [&_button]:font-bold [&_button]:whitespace-nowrap [&_button]:text-(--color-muted) [&_button.active]:bg-(--color-blue-pale) [&_button.active]:text-(--color-blue) transaction-kind [&_button]:flex [&_button]:items-center [&_button]:justify-center [&_button]:gap-1.5 [&_button.expense]:text-red-700 [&_button.income]:text-sky-700 [&_button.expense.active]:bg-red-700 [&_button.expense.active]:text-white [&_button.income.active]:bg-sky-700 [&_button.income.active]:text-white"
            role="group"
            aria-label="ประเภทรายการ"
          >
            <button
              type="button"
              className={`expense ${kind === "expense" ? "active" : ""}`}
              aria-pressed={kind === "expense"}
              onClick={() => setKind("expense")}
            >
              <ArrowUpRight size={17} aria-hidden="true" /> รายจ่าย
              {kind === "expense" && <Check size={16} aria-hidden="true" />}
            </button>
            <button
              type="button"
              className={`income ${kind === "income" ? "active" : ""}`}
              aria-pressed={kind === "income"}
              onClick={() => setKind("income")}
            >
              <ArrowDownLeft size={17} aria-hidden="true" /> รายรับ
              {kind === "income" && <Check size={16} aria-hidden="true" />}
            </button>
          </div>
          <div className="flex flex-col gap-[7px] text-sm font-semibold">
            <span id="transaction-date-label">วันที่</span>
            <input type="hidden" name="date" value={localDate(date)} />
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 w-full justify-between"
                  />
                }
                aria-labelledby="transaction-date-label transaction-date-value"
              >
                <span id="transaction-date-value">
                  {date.toLocaleDateString("th-TH", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <CalendarDays data-icon="inline-end" />
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-2">
                <Calendar
                  mode="single"
                  required
                  selected={date}
                  defaultMonth={date}
                  locale={th}
                  formatters={{
                    formatCaption: (month) =>
                      month.toLocaleDateString("th-TH", {
                        month: "long",
                        year: "numeric",
                      }),
                  }}
                  onSelect={(selected) => {
                    setDate(selected);
                    setCalendarOpen(false);
                  }}
                />

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setDate(new Date());
                    setCalendarOpen(false);
                  }}
                >
                  วันนี้
                </Button>
              </PopoverContent>
            </Popover>
          </div>
          <label>
            {kind === "income" ? "ได้จากอะไร" : "จ่ายค่าอะไร"}
            <Input
              name="description"
              placeholder={
                kind === "income" ? "เช่น เงินค่าขนม" : "เช่น ชานมไข่มุก"
              }
              defaultValue={initial?.description}
              maxLength={80}
              required
            />
          </label>
          <label>
            จำนวนเงิน (บาท)
            <Input
              name="amount"
              type="number"
              className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              defaultValue={initial?.amount}
              required
            />
          </label>
          <Button
            type="submit"
            className="primary-button min-h-[46px] gap-2 rounded-xl bg-(--color-blue) px-[18px] text-sm font-bold text-white hover:bg-(--color-blue-dark)"
          >
            บันทึกรายการ <Check data-icon="inline-end" />
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function App() {
  const [db, setDb] = useState<Database>({ ...emptyDatabase(), loading: true });
  const [page, setPage] = useState<Page>("dashboard");
  const [period, setPeriod] = useState<Period>("month");
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<Transaction>();
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [copied, setCopied] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [requestError, setRequestError] = useState("");
  async function reload() {
    setRequestError("");
    try {
      setDb({ ...(await bootstrap()), loading: false });
    } catch (error) {
      setDb({ ...emptyDatabase(), loading: false });
      setRequestError(
        error instanceof Error ? error.message : "เชื่อมต่อระบบไม่สำเร็จ",
      );
    }
  }
  useEffect(() => {
    void restoreSession()
      .then((data) => {
        setDb({ ...(data ?? emptyDatabase()), loading: false });
      })
      .catch((error: unknown) => {
        setDb({ ...emptyDatabase(), loading: false });
        setRequestError(
          error instanceof Error ? error.message : "เชื่อมต่อระบบไม่สำเร็จ",
        );
      });
  }, []);
  async function runRequest(action: () => Promise<unknown>) {
    setRequestError("");
    setDb((current) => ({ ...current, loading: true }));
    try {
      await action();
      if (hasSession()) await reload();
      else {
        setRequestError("");
        setDb({ ...emptyDatabase(), loading: false });
      }
    } catch (error) {
      setRequestError(
        error instanceof Error ? error.message : "เชื่อมต่อระบบไม่สำเร็จ",
      );
      setDb((current) => ({ ...current, loading: false }));
    }
  }
  const user = db.users.find((item) => item.id === db.currentUserId);
  const family = db.families.find((item) => item.id === user?.familyId);
  const members = useMemo(
    () => db.users.filter((item) => item.familyId === family?.id),
    [db.users, family?.id],
  );
  const transactions = useMemo(
    () =>
      db.transactions
        .filter((item) => item.familyId === family?.id)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [db.transactions, family?.id],
  );
  const filtered = useMemo(
    () => transactions.filter((item) => inPeriod(item.date, period)),
    [transactions, period],
  );
  if (db.loading && !user)
    return (
      <div className="min-h-screen bg-(--color-blue-pale) p-[30px]">
        <Brand />
        <div className="mx-auto my-[50px] max-w-[460px] rounded-(--radius-card) border border-(--color-line) bg-white p-8">
          <span className="eyebrow block text-xs font-semibold text-(--color-blue)">
            เก็บหน่อย
          </span>
          <h1>กำลังเชื่อมต่อข้อมูล…</h1>
        </div>
      </div>
    );

  if (!user)
    return (
      <Auth
        db={db}
        bootstrapError={requestError}
        update={(next) => {
          setPage("dashboard");
          setRequestError("");
          setDb({ ...next, loading: false });
        }}
        reload={reload}
        busy={(loading) => setDb((current) => ({ ...current, loading }))}
        logout={() => void runRequest(signOut)}
      />
    );

  if (!family)
    return (
      <FamilySetup
        db={db}
        update={(next) => {
          void signOut().then(() => setDb(next));
        }}
        reload={reload}
        busy={(loading) => setDb((current) => ({ ...current, loading }))}
        logout={() => void runRequest(signOut)}
      />
    );

  const income = filtered
    .filter((item) => item.kind === "income")
    .reduce((sum, item) => sum + item.amount, 0);
  const expense = filtered
    .filter((item) => item.kind === "expense")
    .reduce((sum, item) => sum + item.amount, 0);
  const ranking = spendingRanking(db.users, family.id, filtered);
  const periodLabel =
    period === "today"
      ? "วันนี้"
      : period === "week"
        ? "7 วันล่าสุด"
        : "เดือนนี้";
  function openNew() {
    setEditing(undefined);
    setDialog(true);
  }
  function saveTransaction(
    value: Pick<Transaction, "kind" | "description" | "amount" | "date">,
  ) {
    if (editing && editing.userId !== user!.id) return;
    void runRequest(async () => {
      if (editing) await updateTransaction(editing.id, value);
      else await createTransaction(value);
      setDialog(false);
      setEditing(undefined);
    });
  }
  function removeTransaction(item: Transaction) {
    if (item.userId === user!.id)
      setConfirmation({ kind: "transaction", transaction: item });
  }
  function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setProfileError("");
    setProfileMessage("");
    const data = new FormData(e.currentTarget);
    const name = String(data.get("name")).trim();
    const email = String(data.get("email")).trim().toLowerCase();
    if (!name) {
      setProfileError("กรุณากรอกชื่อผู้ใช้");
      return;
    }
    void runRequest(async () => {
      await updateProfile(name);
      if (email !== user!.email) await updateCredentials(email);
      setProfileMessage("บันทึกโปรไฟล์เรียบร้อยแล้ว");
    });
  }
  async function uploadAvatar(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfileError("");
    setProfileMessage("");
    if (
      !file.type.match(/^image\/(png|jpeg|gif)$/) ||
      file.size > 1024 * 1024
    ) {
      setProfileError("เลือกรูป PNG, JPEG หรือ GIF ขนาดไม่เกิน 1 MB");
      e.target.value = "";
      return;
    }
    setAvatarBusy(true);
    try {
      const updated = await uploadProfileAvatar(file);
      setDb((current) => ({
        ...current,
        users: current.users.map((item) =>
          item.id === updated.id ? updated : item,
        ),
      }));
      setProfileMessage("อัปโหลดรูปโปรไฟล์เรียบร้อยแล้ว");
    } catch (error) {
      setProfileError(
        error instanceof Error ? error.message : "อัปโหลดรูปโปรไฟล์ไม่สำเร็จ",
      );
    } finally {
      setAvatarBusy(false);
      e.target.value = "";
    }
  }
  async function savePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPasswordError("");
    setPasswordMessage("");
    const form = e.currentTarget;
    const data = new FormData(form);
    const currentPassword = String(data.get("currentPassword") || "");
    const newPassword = String(data.get("newPassword") || "");
    const confirmPassword = String(data.get("confirmPassword") || "");
    if (newPassword.length < 6 || newPassword.length > 72) {
      setPasswordError("รหัสผ่านใหม่ต้องมีความยาว 6–72 ตัวอักษร");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("รหัสผ่านใหม่และการยืนยันไม่ตรงกัน");
      return;
    }
    setPasswordBusy(true);
    try {
      await changePassword(currentPassword, newPassword);
      form.reset();
      setPasswordMessage("เปลี่ยนรหัสผ่านเรียบร้อยแล้ว");
    } catch (error) {
      setPasswordError(
        error instanceof Error ? error.message : "เปลี่ยนรหัสผ่านไม่สำเร็จ",
      );
    } finally {
      setPasswordBusy(false);
    }
  }
  function confirmAction() {
    if (!confirmation) return;
    if (confirmation.kind === "transaction") {
      const target = confirmation.transaction;
      if (target.userId === user!.id)
        void runRequest(() => deleteTransaction(target.id));
    } else if (confirmation.kind === "account") {
      setDb((current) => ({ ...current, loading: true }));
      void deleteAccount()
        .then(() => {
          setRequestError("");
          setDb({ ...emptyDatabase(), loading: false });
        })
        .catch((error) => {
          setRequestError(
            error instanceof Error ? error.message : "ลบบัญชีไม่สำเร็จ",
          );
          setDb((current) => ({ ...current, loading: false }));
        });
    } else {
      void runRequest(leaveFamilyApi);
      setPage("dashboard");
    }
    setConfirmation(null);
  }
  function copyCode() {
    void navigator.clipboard
      .writeText(family!.code)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => setCopied(false));
  }
  const nav = [
    { key: "dashboard" as const, label: "ภาพรวม", icon: House },
    { key: "transactions" as const, label: "รายการทั้งหมด", icon: ReceiptText },
    { key: "family" as const, label: "ครอบครัว", icon: Users },
    { key: "profile" as const, label: "โปรไฟล์", icon: UserRound },
  ];

  const list = page === "dashboard" ? filtered.slice(0, 5) : transactions;
  return (
    <div className="flex min-h-screen bg-(--color-canvas)">
      <aside className="fixed inset-y-0 left-0 z-10 flex w-[240px] flex-col border-r border-(--color-line) bg-white px-[18px] pt-7 pb-[18px] max-[1100px]:w-[205px] max-[768px]:hidden">
        <Brand />
        <div className="mx-3 mt-9 mb-3 text-xs font-bold text-(--color-muted)">
          พื้นที่ของเรา
        </div>
        <nav className="grid gap-[5px]">
          {nav.map((item) => (
            <button
              key={item.key}
              className={`relative flex min-h-12 w-full items-center gap-[13px] rounded-xl px-[13px] py-3 text-left text-sm font-semibold whitespace-nowrap hover:bg-(--color-blue-pale) hover:text-(--color-blue) ${page === item.key || (page === "security" && item.key === "profile") ? "bg-(--color-blue-pale) text-(--color-blue)" : "bg-transparent text-(--color-ink-soft)"}`}
              onClick={() => {
                setPage(item.key);
                setProfileMessage("");
                setProfileError("");
              }}
            >
              <item.icon size={19} />
              <span>{item.label}</span>
              {(page === item.key ||
                (page === "security" && item.key === "profile")) && (
                <span className="ml-auto size-1.5 rounded-full bg-(--color-blue)" />
              )}
            </button>
          ))}
        </nav>
      </aside>
      <main className="ml-[240px] min-w-0 w-[calc(100%-240px)] max-[1100px]:ml-[205px] max-[1100px]:w-[calc(100%-205px)] max-[768px]:ml-0 max-[768px]:w-full max-[768px]:pb-[82px]">
        <header className="flex h-[66px] items-center justify-between border-b border-(--color-line) bg-white px-[42px] max-[1100px]:px-7 max-[768px]:h-[58px] max-[768px]:px-5">
          <div className="text-xs text-(--color-muted) [&_span]:px-2.5 [&_strong]:text-(--color-ink-soft)">
            บ้านของเรา <span>/</span>{" "}
            <strong>
              {page === "security"
                ? "โปรไฟล์ / เปลี่ยนรหัสผ่าน"
                : nav.find((item) => item.key === page)?.label}
            </strong>
          </div>
          <div className="flex items-center gap-5">
            <button
              className="bg-transparent"
              onClick={() => setPage("profile")}
              aria-label="เปิดโปรไฟล์"
            >
              <Avatar user={user} />
            </button>
          </div>
        </header>
        <div className="fixed right-0 bottom-0 left-0 z-20 hidden grid-cols-4 border-t border-(--color-line) bg-white px-[5px] pt-[7px] pb-[max(7px,env(safe-area-inset-bottom))] max-[768px]:grid">
          {nav.map((item) => (
            <button
              key={item.key}
              className={`flex min-h-12 flex-col items-center gap-[3px] bg-transparent py-1 text-[11px] whitespace-nowrap ${page === item.key || (page === "security" && item.key === "profile") ? "text-(--color-blue)" : "text-(--color-muted)"}`}
              onClick={() => setPage(item.key)}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
        <div className="mx-auto max-w-[1320px] px-[42px] pt-8 pb-6 max-[1100px]:p-7 max-[768px]:px-[18px] max-[768px]:py-6">
          {requestError && (
            <p
              className="form-error !text-[11px] !text-(--color-red)"
              role="alert"
            >
              {requestError}
            </p>
          )}
          {page === "dashboard" && (
            <>
              <div className="page-heading mb-6 flex items-end justify-between gap-4 max-[520px]:flex-wrap max-[520px]:items-start max-[520px]:gap-3.5 [&_h1]:mt-1.5 [&_h1]:text-[28px] [&_h1]:leading-normal [&_h1]:font-bold [&_p]:mt-1.5 [&_p]:text-sm [&_p]:text-(--color-ink-soft) max-[520px]:[&_h1]:text-[25px] max-[520px]:[&_p]:text-[13px]">
                <div>
                  <div className="hello-line block text-xs font-semibold text-(--color-blue)">
                    เรื่องเงินของครอบครัว
                  </div>
                  <h1>สวัสดี, {user.name}</h1>
                  <p>รู้ว่าเงินเข้าเท่าไหร่ ใช้ไปเท่าไหร่ ในหน้าเดียว</p>
                </div>
                <Button
                  className="primary-button min-h-[46px] gap-2 rounded-xl bg-(--color-blue) px-[18px] text-sm font-bold text-white hover:bg-(--color-blue-dark) add-button min-w-36 max-[520px]:w-full max-[520px]:min-w-0 max-[520px]:px-[11px]"
                  onClick={openNew}
                >
                  <Plus data-icon="inline-start" /> เพิ่มรายการ
                </Button>
              </div>
              <section className="welcome-banner relative flex min-h-[215px] justify-between overflow-hidden rounded-(--radius-card) border border-(--color-blue-light) bg-(--color-blue-light) max-[520px]:min-h-[200px]">
                <div className="banner-copy z-[2] px-[33px] py-[29px] max-[520px]:px-[19px] max-[520px]:py-[23px] [&_h2]:mt-[13px] [&_h2]:mb-1.5 [&_h2]:text-[25px] [&_h2]:leading-[1.35] [&_h2]:font-bold [&_h2]:text-(--color-blue-dark) [&_h2_span]:text-(--color-ink) [&_p]:text-[11px] [&_p]:text-(--color-ink-soft) [&_button]:mt-[15px] [&_button]:flex [&_button]:items-center [&_button]:gap-2 [&_button]:bg-transparent [&_button]:p-0 [&_button]:text-[11px] [&_button]:font-extrabold [&_button]:text-(--color-blue-dark) max-[520px]:[&_h2]:text-[19px] max-[520px]:[&_p]:max-w-[190px] max-[520px]:[&_p]:text-[10px]">
                  <span className="banner-chip inline-block bg-white px-[9px] py-1.5 font-(family-name:--font-number) text-[8px] font-bold tracking-[0.09em] text-(--color-blue)">
                    ✦ &nbsp; LITTLE STEPS, BIG DREAMS
                  </span>
                  <h2>
                    เก็บเรื่องเล็ก ๆ<br />
                    <span>ให้เป็นเรื่องใหญ่ไปด้วยกัน</span>
                  </h2>
                  <p>บันทึกทุกการใช้จ่าย แล้วค่อย ๆ เติบโตไปพร้อมกันนะ</p>
                  <button onClick={() => setPage("family")}>
                    ไปดูครอบครัวของเรา <ArrowRight size={16} />
                  </button>
                </div>
                <div className="banner-art absolute right-[8%] bottom-[-19px] h-[200px] w-[260px] max-[1100px]:right-[2%] max-[520px]:right-[-8px] max-[520px]:bottom-[-22px] max-[520px]:origin-bottom-right max-[520px]:scale-55 [&_.pixel-pal]:absolute [&_.pixel-pal]:right-[45px] [&_.pixel-pal]:bottom-2 [&_.pixel-pal]:origin-bottom [&_.pixel-pal]:scale-95">
                  <span className="banner-star absolute text-[26px] text-(--color-blue) star-a top-5 right-[30px]">
                    ✦
                  </span>
                  <span className="banner-star absolute text-[26px] text-(--color-blue) star-b top-[35px] left-[30px] text-lg">
                    ✳
                  </span>
                  <span className="banner-cloud absolute h-3 w-[50px] bg-white opacity-75 shadow-[12px_-8px_0_white] cloud-a top-[65px] left-2.5" />
                  <span className="banner-cloud absolute h-3 w-[50px] bg-white opacity-75 shadow-[12px_-8px_0_white] cloud-b top-[15px] right-2 scale-70" />
                  <div className="banner-coin absolute bottom-[43px] left-[22px] grid size-[45px] -rotate-12 place-items-center border-4 border-(--color-blue-dark) bg-white text-2xl font-bold text-(--color-blue-dark)">
                    ฿
                  </div>
                  <PixelPal />
                </div>
                <span className="banner-grid absolute right-0 bottom-0 h-7 w-[43%] opacity-[0.08] bg-[repeating-linear-gradient(90deg,var(--color-blue)_0_2px,transparent_2px_24px)]" />
              </section>
              <div className="section-heading flex items-center justify-between gap-4 [&_h2]:mt-[5px] [&_h2]:text-xl [&_h2]:font-bold summary-heading mt-[26px] mb-[15px] max-[520px]:flex-col max-[520px]:items-start">
                <div>
                  <span className="eyebrow block text-xs font-semibold text-(--color-blue)">
                    สรุปรายรับรายจ่าย
                  </span>
                  <h2>ภาพรวม · {periodLabel}</h2>
                </div>
                <div
                  className="period-select flex gap-[3px] rounded-[9px] border border-(--color-line) bg-white p-1 max-[520px]:w-full [&_button]:min-h-10 [&_button]:rounded-md [&_button]:bg-transparent [&_button]:px-[13px] [&_button]:py-2 [&_button]:text-[13px] [&_button]:font-bold [&_button]:whitespace-nowrap [&_button]:text-(--color-muted) [&_button.active]:bg-(--color-blue-pale) [&_button.active]:text-(--color-blue) max-[520px]:[&_button]:flex-1"
                  role="group"
                  aria-label="เลือกช่วงเวลา"
                >
                  {(
                    [
                      ["today", "วันนี้"],
                      ["week", "7 วันล่าสุด"],
                      ["month", "เดือนนี้"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      aria-pressed={period === value}
                      className={period === value ? "active" : ""}
                      onClick={() => setPeriod(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="stats-grid grid grid-cols-3 gap-[15px] max-[1100px]:gap-2.5 max-[520px]:grid-cols-2">
                <div
                  className={`stat-card min-w-0 rounded-(--radius-card) border border-(--color-line) bg-white p-[22px] shadow-[0_3px_14px_#16345104] max-[1100px]:p-4 [&_strong]:my-[5px] [&_strong]:block [&_strong]:font-(family-name:--font-number) [&_strong]:text-[clamp(24px,2.6vw,36px)] [&_strong]:font-bold [&_strong]:tracking-[-0.035em] [&_strong]:[overflow-wrap:anywhere] [&_small]:block [&_small]:text-xs [&_small]:text-(--color-muted) max-[1100px]:[&_small]:text-[11px] max-[520px]:[&_strong]:text-[23px] balance-card border-green-800 bg-linear-to-br from-green-800 to-emerald-700 text-white max-[520px]:col-span-full [&_.stat-label]:text-green-50 [&_.stat-meta]:text-green-50 [&_small]:text-green-50 [&_.stat-icon]:bg-white/15 [&_.stat-icon]:text-white max-[520px]:[&_strong]:text-[34px] [&.is-negative]:border-red-800 [&.is-negative]:from-red-800 [&.is-negative]:to-red-700 ${income - expense < 0 ? "is-negative" : ""}`}
                >
                  <div className="stat-top mb-4 flex items-center justify-between max-[520px]:mb-3">
                    <span className="stat-icon grid size-[38px] place-items-center rounded-[10px] [&.income]:bg-(--color-income-pale) [&.income]:text-(--color-income) [&.expense]:bg-(--color-expense-pale) [&.expense]:text-(--color-expense) [&.family-icon]:bg-(--color-blue-pale) [&.family-icon]:text-(--color-blue) family-icon">
                      <Wallet size={20} />
                    </span>
                    <span className="stat-meta text-xs text-(--color-muted)">
                      {periodLabel}
                    </span>
                  </div>
                  <span className="stat-label block text-sm text-(--color-ink-soft) max-[520px]:text-[13px]">
                    ส่วนต่างรายรับ − รายจ่าย
                  </span>
                  <strong>฿{money(income - expense)}</strong>
                  <small>
                    {income === 0 && expense === 0
                      ? "เริ่มบันทึกเพื่อดูสรุปของครอบครัว"
                      : income >= expense
                        ? "รายรับมากกว่าหรือเท่ากับรายจ่าย"
                        : "รายจ่ายมากกว่ารายรับในช่วงนี้"}
                  </small>
                </div>
                <div className="stat-card min-w-0 rounded-(--radius-card) border border-(--color-line) bg-white p-[22px] shadow-[0_3px_14px_#16345104] max-[1100px]:p-4 [&_strong]:my-[5px] [&_strong]:block [&_strong]:font-(family-name:--font-number) [&_strong]:text-[clamp(24px,2.6vw,36px)] [&_strong]:font-bold [&_strong]:tracking-[-0.035em] [&_strong]:[overflow-wrap:anywhere] [&_small]:block [&_small]:text-xs [&_small]:text-(--color-muted) max-[1100px]:[&_small]:text-[11px] max-[520px]:[&_strong]:text-[23px] income-card border-sky-200 bg-linear-to-br from-white to-(--color-income-pale) [&_strong]:text-(--color-income)">
                  <div className="stat-top mb-4 flex items-center justify-between max-[520px]:mb-3">
                    <span className="stat-icon grid size-[38px] place-items-center rounded-[10px] [&.income]:bg-(--color-income-pale) [&.income]:text-(--color-income) [&.expense]:bg-(--color-expense-pale) [&.expense]:text-(--color-expense) [&.family-icon]:bg-(--color-blue-pale) [&.family-icon]:text-(--color-blue) income">
                      <TrendingUp size={20} />
                    </span>
                    <span className="stat-meta text-xs text-(--color-muted)">
                      {periodLabel}
                    </span>
                  </div>
                  <span className="stat-label block text-sm text-(--color-ink-soft) max-[520px]:text-[13px]">
                    รายรับรวม
                  </span>
                  <strong>฿{money(income)}</strong>
                  <small>เงินที่ครอบครัวได้รับในช่วงนี้</small>
                </div>
                <div className="stat-card min-w-0 rounded-(--radius-card) border border-(--color-line) bg-white p-[22px] shadow-[0_3px_14px_#16345104] max-[1100px]:p-4 [&_strong]:my-[5px] [&_strong]:block [&_strong]:font-(family-name:--font-number) [&_strong]:text-[clamp(24px,2.6vw,36px)] [&_strong]:font-bold [&_strong]:tracking-[-0.035em] [&_strong]:[overflow-wrap:anywhere] [&_small]:block [&_small]:text-xs [&_small]:text-(--color-muted) max-[1100px]:[&_small]:text-[11px] max-[520px]:[&_strong]:text-[23px] expense-card border-red-200 bg-linear-to-br from-white to-(--color-expense-pale) [&_strong]:text-(--color-expense)">
                  <div className="stat-top mb-4 flex items-center justify-between max-[520px]:mb-3">
                    <span className="stat-icon grid size-[38px] place-items-center rounded-[10px] [&.income]:bg-(--color-income-pale) [&.income]:text-(--color-income) [&.expense]:bg-(--color-expense-pale) [&.expense]:text-(--color-expense) [&.family-icon]:bg-(--color-blue-pale) [&.family-icon]:text-(--color-blue) expense">
                      <TrendingDown size={20} />
                    </span>
                    <span className="stat-meta text-xs text-(--color-muted)">
                      {periodLabel}
                    </span>
                  </div>
                  <span className="stat-label block text-sm text-(--color-ink-soft) max-[520px]:text-[13px]">
                    รายจ่ายรวม
                  </span>
                  <strong>฿{money(expense)}</strong>
                  <small>เงินที่ครอบครัวใช้ไปในช่วงนี้</small>
                </div>
              </div>
              <div className="dashboard-grid mt-5 grid grid-cols-[minmax(0,1.8fr)_minmax(230px,1fr)] gap-[18px] max-[1100px]:grid-cols-1">
                <section className="panel min-w-0 rounded-(--radius-card) border border-(--color-line) bg-white p-6 shadow-[0_3px_14px_#16345104] max-[768px]:p-5 max-[520px]:p-[17px] chart-panel border-blue-100 bg-linear-to-b from-[#f5faff] to-white [&_.panel-heading]:flex-wrap">
                  <div className="panel-heading flex items-center justify-between gap-4 max-[520px]:gap-2.5 [&_h2]:text-[17px] [&_h2]:leading-normal [&_h2]:font-bold [&_p]:mt-[5px] [&_p]:text-xs [&_p]:text-(--color-muted) max-[520px]:[&_h2]:text-base">
                    <div>
                      <h2>เงินเข้า เงินออก</h2>
                      <p>ความเคลื่อนไหวของครอบครัว · {periodLabel}</p>
                    </div>
                    <div className="legend flex gap-3 text-xs whitespace-nowrap text-(--color-ink-soft) [&_span]:flex [&_span]:items-center [&_span]:gap-[5px] [&_i]:h-0 [&_i]:w-[22px] [&_i]:border-t-[3px]">
                      <span>
                        <i className="legend-income border-(--color-chart-income)" />
                        รายรับ
                      </span>
                      <span>
                        <i className="legend-expense border-dashed border-(--color-chart-expense)" />
                        รายจ่าย
                      </span>
                    </div>
                  </div>
                  <Chart transactions={filtered} period={period} />
                  {period === "today" && (
                    <small className="chart-note mt-[5px] block text-[10px] text-(--color-muted)">
                      วันนี้แสดงตามเวลาที่บันทึกรายการ
                    </small>
                  )}
                </section>
                <section className="panel min-w-0 rounded-(--radius-card) border border-(--color-line) bg-white p-6 shadow-[0_3px_14px_#16345104] max-[768px]:p-5 max-[520px]:p-[17px] top-panel">
                  <div className="panel-heading flex items-center justify-between gap-4 max-[520px]:gap-2.5 [&_h2]:text-[17px] [&_h2]:leading-normal [&_h2]:font-bold [&_p]:mt-[5px] [&_p]:text-xs [&_p]:text-(--color-muted) max-[520px]:[&_h2]:text-base">
                    <div>
                      <h2>รายจ่ายแยกตามสมาชิก</h2>
                      <p>รายจ่ายของทุกคน · {periodLabel}</p>
                    </div>
                    <Users size={20} />
                  </div>
                  <div className="spending-list mt-3.5">
                    {ranking.map(({ member, amount }, index) => (
                      <div
                        className="spending-row flex min-w-0 items-center gap-2.5 border-t border-(--color-line) py-[11px]"
                        key={member.id}
                      >
                        <span
                          className={
                            index === 0 && amount > 0
                              ? "spending-rank w-[18px] flex-none text-center font-(family-name:--font-number) text-xs font-bold text-(--color-muted) [&.first]:text-xl [&.first]:text-(--color-expense) first"
                              : "spending-rank w-[18px] flex-none text-center font-(family-name:--font-number) text-xs font-bold text-(--color-muted) [&.first]:text-xl [&.first]:text-(--color-expense)"
                          }
                        >
                          {index + 1}
                        </span>
                        <Avatar user={member} />
                        <div className="spending-name min-w-0 flex-1 [&_strong]:block [&_strong]:truncate [&_strong]:text-xs [&_small]:mt-[3px] [&_small]:block [&_small]:truncate [&_small]:text-[10px] [&_small]:text-(--color-ink-soft)">
                          <strong>
                            {member.name}
                            {member.id === user.id && (
                              <span className="you-badge text-[10px] text-(--color-blue)">
                                {" "}
                                คุณ
                              </span>
                            )}
                          </strong>
                          <small>
                            {member.familyId === family.id
                              ? "สมาชิกครอบครัว"
                              : "ออกจากครอบครัวแล้ว"}
                          </small>
                        </div>
                        <strong className="spending-amount flex-none font-(family-name:--font-number) text-xs font-bold whitespace-nowrap text-(--color-blue-dark)">
                          ฿{money(amount)}
                        </strong>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </>
          )}
          {page === "transactions" && (
            <div className="page-heading mb-6 flex items-end justify-between gap-4 max-[520px]:flex-wrap max-[520px]:items-start max-[520px]:gap-3.5 [&_h1]:mt-1.5 [&_h1]:text-[28px] [&_h1]:leading-normal [&_h1]:font-bold [&_p]:mt-1.5 [&_p]:text-sm [&_p]:text-(--color-ink-soft) max-[520px]:[&_h1]:text-[25px] max-[520px]:[&_p]:text-[13px]">
              <div>
                <span className="eyebrow block text-xs font-semibold text-(--color-blue)">
                  บันทึกรายรับรายจ่าย
                </span>
                <h1>รายการทั้งหมด</h1>
                <p>ทุกเรื่องเงินของครอบครัว อยู่รวมกันตรงนี้</p>
              </div>
              <Button
                className="primary-button min-h-[46px] gap-2 rounded-xl bg-(--color-blue) px-[18px] text-sm font-bold text-white hover:bg-(--color-blue-dark) add-button min-w-36 max-[520px]:w-full max-[520px]:min-w-0 max-[520px]:px-[11px]"
                onClick={openNew}
              >
                <Plus data-icon="inline-start" /> เพิ่มรายการ
              </Button>
            </div>
          )}
          {(page === "dashboard" || page === "transactions") && (
            <section className="panel min-w-0 rounded-(--radius-card) border border-(--color-line) bg-white p-6 shadow-[0_3px_14px_#16345104] max-[768px]:p-5 max-[520px]:p-[17px] transactions-panel mt-5">
              <div className="panel-heading flex items-center justify-between gap-4 max-[520px]:gap-2.5 [&_h2]:text-[17px] [&_h2]:leading-normal [&_h2]:font-bold [&_p]:mt-[5px] [&_p]:text-xs [&_p]:text-(--color-muted) max-[520px]:[&_h2]:text-base">
                <div>
                  <h2>
                    {page === "dashboard"
                      ? "รายการล่าสุด"
                      : "รายการของครอบครัว"}
                  </h2>
                  <p>
                    {page === "dashboard"
                      ? `5 รายการล่าสุด · ${periodLabel}`
                      : `ทั้งหมด ${transactions.length} รายการ`}
                  </p>
                </div>
                {page === "dashboard" && (
                  <button
                    className="view-all flex min-h-11 items-center gap-1.5 bg-transparent text-[13px] font-bold whitespace-nowrap text-(--color-blue)"
                    onClick={() => setPage("transactions")}
                  >
                    ดูทั้งหมด <ArrowRight size={15} />
                  </button>
                )}
              </div>
              <div className="transaction-list mt-3.5">
                {list.length === 0 ? (
                  <div className="empty-small flex flex-col items-center gap-2.5 px-3 py-9 text-center text-[13px] text-(--color-muted) [&_strong]:text-base [&_strong]:text-(--color-ink) [&_.primary-button]:mt-2">
                    <ReceiptText size={28} />
                    <strong>
                      ยังไม่มีรายการ
                      {page === "dashboard" ? `ในช่วง${periodLabel}` : ""}
                    </strong>
                    <span>
                      เพิ่มรายรับหรือรายจ่าย เพื่อเริ่มดูภาพรวมของบ้าน
                    </span>
                    <Button
                      className="primary-button min-h-[46px] gap-2 rounded-xl bg-(--color-blue) px-[18px] text-sm font-bold text-white hover:bg-(--color-blue-dark)"
                      onClick={openNew}
                    >
                      <Plus size={16} /> เพิ่มรายการแรก
                    </Button>
                  </div>
                ) : (
                  list.map((item) => {
                    const owner = db.users.find(
                      (member) => member.id === item.userId,
                    );
                    return (
                      <div
                        className="transaction-row flex items-center gap-3 border-t border-(--color-line) py-4 max-[520px]:flex-wrap max-[520px]:gap-2.5"
                        key={item.id}
                      >
                        <span
                          className={`transaction-icon grid size-[38px] flex-none place-items-center rounded-[10px] [&.income]:bg-(--color-income-pale) [&.income]:text-(--color-income) [&.expense]:bg-(--color-expense-pale) [&.expense]:text-(--color-expense) ${item.kind}`}
                        >
                          {item.kind === "income" ? (
                            <ArrowDownLeft size={19} />
                          ) : (
                            <ArrowUpRight size={19} />
                          )}
                        </span>
                        <div className="transaction-name min-w-0 flex-1 max-[520px]:basis-[calc(100%-50px)] [&_strong]:block [&_strong]:truncate [&_strong]:text-sm [&_span]:mt-[3px] [&_span]:block [&_span]:text-xs [&_span]:text-(--color-muted) [&_i]:px-1 [&_i]:not-italic max-[520px]:[&_strong]:whitespace-normal max-[520px]:[&_strong]:[overflow-wrap:anywhere]">
                          <strong>{item.description}</strong>
                          <span>
                            {dateText(item.date)} <i>·</i>{" "}
                            {owner?.name || "สมาชิก"}
                          </span>
                        </div>
                        <span
                          className={`transaction-amount font-(family-name:--font-number) text-[15px] font-bold whitespace-nowrap max-[520px]:ml-12 [&.income]:text-(--color-income) [&.expense]:text-(--color-expense) ${item.kind}`}
                        >
                          {item.kind === "income" ? "+" : "−"}฿
                          {money(item.amount)}
                        </span>
                        {item.userId === user.id && (
                          <div className="row-actions flex gap-1 max-[520px]:ml-auto max-[520px]:gap-0 [&_button]:min-h-10 [&_button]:min-w-10 [&_button]:rounded-lg [&_button]:bg-transparent [&_button]:p-1.5 [&_button]:text-(--color-muted) [&_button:hover]:bg-(--color-blue-pale) [&_button:hover]:text-(--color-blue)">
                            <button
                              aria-label={`แก้ไข ${item.description}`}
                              onClick={() => {
                                setEditing(item);
                                setDialog(true);
                              }}
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              aria-label={`ลบ ${item.description}`}
                              onClick={() => removeTransaction(item)}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          )}
          {page === "family" && (
            <>
              <div className="page-heading mb-6 flex items-end justify-between gap-4 max-[520px]:flex-wrap max-[520px]:items-start max-[520px]:gap-3.5 [&_h1]:mt-1.5 [&_h1]:text-[28px] [&_h1]:leading-normal [&_h1]:font-bold [&_p]:mt-1.5 [&_p]:text-sm [&_p]:text-(--color-ink-soft) max-[520px]:[&_h1]:text-[25px] max-[520px]:[&_p]:text-[13px]">
                <div>
                  <span className="eyebrow block text-xs font-semibold text-(--color-blue)">
                    จัดการครอบครัว
                  </span>
                  <h1>ครอบครัวของเรา</h1>
                  <p>เพราะเรื่องเงินสนุกขึ้น เมื่อเราเก็บไปด้วยกัน</p>
                </div>
              </div>
              <div className="family-grid grid grid-cols-2 gap-4 max-[520px]:grid-cols-1">
                <section className="panel min-w-0 rounded-(--radius-card) border border-(--color-line) bg-white p-6 shadow-[0_3px_14px_#16345104] max-[768px]:p-5 max-[520px]:p-[17px] family-card text-center [&_h2]:my-[9px] [&_h2]:text-2xl [&_h2]:font-bold [&_p]:block [&_p]:text-[11px] [&_p]:text-(--color-muted) [&_small]:mt-3 [&_small]:block [&_small]:text-[11px] [&_small]:text-(--color-muted)">
                  <div className="family-card-icon mx-auto mb-5 grid size-[50px] place-items-center rounded-xl bg-(--color-blue-pale) text-(--color-blue)">
                    <House size={24} />
                  </div>
                  <span className="eyebrow block text-xs font-semibold text-(--color-blue)">
                    ครอบครัวของคุณ
                  </span>
                  <h2>{family.name}</h2>
                  <p>ส่งรหัสนี้ให้สมาชิก เพื่อชวนเข้าร่วมครอบครัว</p>
                  <div className="family-code my-6 flex justify-center gap-2 [&_span]:grid [&_span]:h-[58px] [&_span]:w-12 [&_span]:place-items-center [&_span]:border-2 [&_span]:border-(--color-blue-light) [&_span]:bg-(--color-blue-pale) [&_span]:font-(family-name:--font-number) [&_span]:text-[26px] [&_span]:font-bold [&_span]:text-(--color-blue-dark)">
                    {family.code.split("").map((digit, index) => (
                      <span key={index}>{digit}</span>
                    ))}
                  </div>
                  <Button variant="outline" onClick={copyCode}>
                    <Copy data-icon="inline-start" />{" "}
                    {copied ? "คัดลอกแล้ว" : "คัดลอกรหัส"}
                  </Button>
                  <small>สมาชิกใช้รหัสนี้เพื่อเข้าร่วมจากอุปกรณ์ของตนเอง</small>
                </section>
                <section className="panel min-w-0 rounded-(--radius-card) border border-(--color-line) bg-white p-6 shadow-[0_3px_14px_#16345104] max-[768px]:p-5 max-[520px]:p-[17px] members-card">
                  <div className="panel-heading flex items-center justify-between gap-4 max-[520px]:gap-2.5 [&_h2]:text-[17px] [&_h2]:leading-normal [&_h2]:font-bold [&_p]:mt-[5px] [&_p]:text-xs [&_p]:text-(--color-muted) max-[520px]:[&_h2]:text-base">
                    <div>
                      <h2>สมาชิกในบ้าน</h2>
                      <p>มีทั้งหมด {members.length} คน</p>
                    </div>
                    <Users size={20} />
                  </div>
                  {members.map((member) => (
                    <div
                      className="member-row flex items-center gap-3 border-b border-(--color-line) py-[17px] [&_strong]:block [&_strong]:text-xs [&_small]:mt-[3px] [&_small]:block [&_small]:text-[10px] [&_small]:text-(--color-muted)"
                      key={member.id}
                    >
                      <Avatar user={member} />
                      <div>
                        <strong>
                          {member.name}{" "}
                          {member.id === user.id && (
                            <span className="you-badge text-[10px] text-(--color-blue)">
                              คุณ
                            </span>
                          )}
                        </strong>
                        <small>{member.email}</small>
                      </div>
                    </div>
                  ))}
                  <div className="leave-family mt-[22px] border-t border-(--color-line) pt-[18px] [&_p]:mb-3 [&_p]:text-[11px] [&_p]:text-(--color-ink-soft)">
                    <p>ต้องการย้ายบ้าน? คุณสามารถออกจากครอบครัวนี้ได้</p>
                    <Button
                      variant="outline"
                      onClick={() => setConfirmation({ kind: "leave" })}
                    >
                      <LogOut data-icon="inline-start" /> ออกจากครอบครัว
                    </Button>
                  </div>
                </section>
              </div>
            </>
          )}
          {page === "profile" && (
            <>
              <div className="page-heading mb-6 flex items-end justify-between gap-4 max-[520px]:flex-wrap max-[520px]:items-start max-[520px]:gap-3.5 [&_h1]:mt-1.5 [&_h1]:text-[28px] [&_h1]:leading-normal [&_h1]:font-bold [&_p]:mt-1.5 [&_p]:text-sm [&_p]:text-(--color-ink-soft) max-[520px]:[&_h1]:text-[25px] max-[520px]:[&_p]:text-[13px]">
                <div>
                  <span className="eyebrow block text-xs font-semibold text-(--color-blue)">
                    บัญชีของคุณ
                  </span>
                  <h1>โปรไฟล์ของฉัน</h1>
                  <p>จัดการข้อมูลส่วนตัวของคุณได้ที่นี่</p>
                </div>
              </div>
              <section className="panel min-w-0 rounded-(--radius-card) border border-(--color-line) bg-white p-6 shadow-[0_3px_14px_#16345104] max-[768px]:p-5 max-[520px]:p-[17px] profile-panel max-w-[720px]">
                <div className="profile-intro flex items-center gap-[18px] border-b border-(--color-line) pb-6 [&_h2]:text-[19px] [&_h2]:font-bold [&_p]:mt-1 [&_p]:mb-2.5 [&_p]:text-[11px] [&_p]:text-(--color-muted)">
                  <Avatar user={user} size="large" />
                  <div>
                    <h2>{user.name}</h2>
                    <p>อัปโหลดรูปภาพขนาดไม่เกิน 1 MB</p>
                    <label className="upload-button inline-block cursor-pointer text-[11px] font-bold text-(--color-blue) [&_input]:absolute [&_input]:size-px [&_input]:opacity-0">
                      {avatarBusy ? "กำลังอัปโหลด…" : "เปลี่ยนรูปโปรไฟล์"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/gif"
                        disabled={avatarBusy}
                        onChange={uploadAvatar}
                      />
                    </label>
                  </div>
                </div>
                <form
                  className="form-stack flex flex-col gap-4 [&_label]:flex [&_label]:flex-col [&_label]:gap-[7px] [&_label]:text-sm [&_label]:font-bold [&_label]:text-(--color-ink) [&_input:not([type=hidden])]:min-h-[46px] [&_input:not([type=hidden])]:bg-white [&_input:not([type=hidden])]:text-base [&_.primary-button]:w-full profile-form mt-6"
                  onSubmit={saveProfile}
                  key={user.id}
                >
                  <label>
                    ชื่อผู้ใช้
                    <Input
                      name="name"
                      defaultValue={user.name}
                      required
                      maxLength={40}
                    />
                  </label>
                  <label>
                    อีเมล
                    <Input
                      name="email"
                      type="email"
                      defaultValue={user.email}
                      required
                    />
                  </label>
                  {profileError && (
                    <p
                      className="form-error !text-[11px] !text-(--color-red)"
                      role="alert"
                    >
                      {profileError}
                    </p>
                  )}
                  {profileMessage && (
                    <p
                      className="form-notice !text-[11px] !text-(--color-income)"
                      role="status"
                    >
                      {profileMessage}
                    </p>
                  )}
                  <Button
                    type="submit"
                    className="primary-button min-h-[46px] gap-2 rounded-xl bg-(--color-blue) px-[18px] text-sm font-bold text-white hover:bg-(--color-blue-dark)"
                  >
                    บันทึกการเปลี่ยนแปลง
                  </Button>
                </form>
                <div className="profile-action mt-[30px] flex items-center justify-between gap-[15px] border-t border-(--color-line) pt-[22px] [&_p]:m-0 [&_p]:text-[11px] [&_p]:text-(--color-muted)">
                  <p>จัดการรหัสผ่านสำหรับเข้าสู่ระบบ</p>
                  <button
                    type="button"
                    className="profile-security-link shrink-0 cursor-pointer bg-transparent p-0 text-left text-[13px] font-bold text-(--color-blue) hover:underline focus-visible:underline"
                    onClick={() => {
                      setPasswordError("");
                      setPasswordMessage("");
                      setPage("security");
                    }}
                  >
                    เปลี่ยนรหัสผ่าน
                  </button>
                </div>
                <div className="profile-action mt-[30px] flex items-center justify-between gap-[15px] border-t border-(--color-line) pt-[22px] [&_p]:m-0 [&_p]:text-[11px] [&_p]:text-(--color-muted)">
                  <p>บัญชีและรายการส่วนตัวของคุณจะถูกลบอย่างถาวร</p>
                  <button
                    type="button"
                    className="danger-delete-link shrink-0 cursor-pointer bg-transparent p-0 text-left text-[13px] font-bold text-(--color-red) hover:underline focus-visible:underline"
                    onClick={() => setConfirmation({ kind: "account" })}
                  >
                    ลบบัญชี
                  </button>
                </div>
                <Button
                  variant="outline"
                  className="profile-logout mt-5"
                  onClick={() => void runRequest(signOut)}
                >
                  <LogOut data-icon="inline-start" /> ออกจากระบบ
                </Button>
              </section>
            </>
          )}
          {page === "security" && (
            <>
              <div className="page-heading mb-6 flex items-end justify-between gap-4 max-[520px]:flex-wrap max-[520px]:items-start max-[520px]:gap-3.5 [&_h1]:mt-1.5 [&_h1]:text-[28px] [&_h1]:leading-normal [&_h1]:font-bold [&_p]:mt-1.5 [&_p]:text-sm [&_p]:text-(--color-ink-soft) max-[520px]:[&_h1]:text-[25px] max-[520px]:[&_p]:text-[13px]">
                <div>
                  <span className="eyebrow block text-xs font-semibold text-(--color-blue)">
                    ACCOUNT SECURITY
                  </span>
                  <h1>เปลี่ยนรหัสผ่าน</h1>
                  <p>ใช้รหัสผ่านปัจจุบันเพื่อยืนยันก่อนตั้งรหัสผ่านใหม่</p>
                </div>
              </div>
              <section className="panel min-w-0 rounded-(--radius-card) border border-(--color-line) bg-white p-6 shadow-[0_3px_14px_#16345104] max-[768px]:p-5 max-[520px]:p-[17px] profile-panel max-w-[720px] security-panel">
                <button
                  type="button"
                  className="security-back mb-5 inline-flex items-center gap-1.5 text-[13px] font-bold text-(--color-blue)"
                  onClick={() => setPage("profile")}
                >
                  <ArrowLeft size={16} /> กลับไปหน้าโปรไฟล์
                </button>
                <form
                  className="form-stack flex flex-col gap-4 [&_label]:flex [&_label]:flex-col [&_label]:gap-[7px] [&_label]:text-sm [&_label]:font-bold [&_label]:text-(--color-ink) [&_input:not([type=hidden])]:min-h-[46px] [&_input:not([type=hidden])]:bg-white [&_input:not([type=hidden])]:text-base [&_.primary-button]:w-full"
                  onSubmit={savePassword}
                >
                  <label>
                    รหัสผ่านปัจจุบัน
                    <Input
                      name="currentPassword"
                      type="password"
                      autoComplete="current-password"
                      required
                    />
                  </label>
                  <label>
                    รหัสผ่านใหม่
                    <Input
                      name="newPassword"
                      type="password"
                      autoComplete="new-password"
                      minLength={6}
                      maxLength={72}
                      required
                    />
                  </label>
                  <label>
                    ยืนยันรหัสผ่านใหม่
                    <Input
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      minLength={6}
                      maxLength={72}
                      required
                    />
                  </label>
                  {passwordError && (
                    <p
                      className="form-error !text-[11px] !text-(--color-red)"
                      role="alert"
                    >
                      {passwordError}
                    </p>
                  )}
                  {passwordMessage && (
                    <p
                      className="form-notice !text-[11px] !text-(--color-income)"
                      role="status"
                    >
                      {passwordMessage}
                    </p>
                  )}
                  <Button
                    type="submit"
                    className="primary-button min-h-[46px] gap-2 rounded-xl bg-(--color-blue) px-[18px] text-sm font-bold text-white hover:bg-(--color-blue-dark)"
                    disabled={passwordBusy}
                  >
                    {passwordBusy ? "กำลังบันทึก…" : "บันทึกรหัสผ่านใหม่"}
                  </Button>
                </form>
              </section>
            </>
          )}
          <footer className="footer flex justify-between gap-3 pt-6 pb-0.5 text-[11px] font-medium text-(--color-muted) max-[520px]:flex-col">
            <span>เก็บหน่อย · เรื่องเงินของบ้านเรา</span>
            <span>ค่อย ๆ เก็บ ค่อย ๆ โตไปด้วยกัน ✦</span>
          </footer>
        </div>
      </main>
      {dialog && (
        <TransactionDialog
          open={dialog}
          close={() => setDialog(false)}
          initial={editing}
          save={saveTransaction}
        />
      )}
      <Dialog
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
      >
        <DialogContent className="app-dialog w-[calc(100%-32px)] max-w-[440px] p-[25px] [&_[data-slot=dialog-title]]:text-[21px] [&_[data-slot=dialog-title]]:font-bold [&_[data-slot=dialog-description]]:text-xs [&_[data-slot=dialog-description]]:text-(--color-ink-soft) confirm-dialog">
          <DialogHeader>
            <DialogTitle>
              {confirmation?.kind === "leave"
                ? "ออกจากครอบครัว?"
                : confirmation?.kind === "account"
                  ? "ลบบัญชี?"
                  : "ลบรายการ?"}
            </DialogTitle>
            <DialogDescription>
              {confirmation?.kind === "leave"
                ? "คุณจะออกจากครอบครัวนี้ และสามารถสร้างหรือเข้าร่วมครอบครัวใหม่ได้ รายการที่เคยบันทึกจะยังอยู่กับครอบครัวเดิม"
                : confirmation?.kind === "account"
                  ? "บัญชีและรายการทั้งหมดของคุณจะถูกลบ การกระทำนี้ย้อนกลับไม่ได้"
                  : confirmation?.kind === "transaction"
                    ? `ต้องการลบรายการ “${confirmation.transaction.description}” ใช่ไหม? การกระทำนี้ย้อนกลับไม่ได้`
                    : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="confirm-actions mt-2 flex flex-wrap justify-end gap-2 [&_button]:min-h-10 [&_button]:whitespace-nowrap">
            <Button variant="outline" onClick={() => setConfirmation(null)}>
              ยกเลิก
            </Button>
            <Button
              className="confirm-destructive bg-(--color-red) text-white hover:bg-(--color-red) hover:opacity-90"
              onClick={confirmAction}
            >
              {confirmation?.kind === "leave"
                ? "ยืนยันออกจากครอบครัว"
                : confirmation?.kind === "account"
                  ? "ยืนยันลบบัญชี"
                  : "ยืนยันลบรายการ"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
export default App;
