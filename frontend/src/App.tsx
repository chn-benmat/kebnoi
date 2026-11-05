import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Copy,
  House,
  LogOut,
  Pencil,
  Plus,
  ReceiptText,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserRound,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  bootstrap,
  createTransaction,
  deleteAccount,
  deleteTransaction,
  emptyDatabase,
  hasSession,
  leaveFamily as leaveFamilyApi,
  signOut,
  updateCredentials,
  updateProfile,
  updateTransaction,
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
import "./App.css";

type Page = "dashboard" | "transactions" | "family" | "profile";
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
    <span className={`avatar ${size}`}>
      {user?.avatar ? (
        <img src={user.avatar} alt="" />
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
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const amount = Number(data.get("amount"));
    const description = String(data.get("description")).trim();
    if (!description || !Number.isFinite(amount) || amount <= 0) return;
    save({ kind, date: String(data.get("date")), description, amount });
    close();
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent className="app-dialog">
        <DialogHeader>
          <DialogTitle>
            {initial ? "แก้ไขรายการ" : "เพิ่มรายการใหม่"}
          </DialogTitle>
          <DialogDescription>
            เก็บทุกเรื่องเงินเล็ก ๆ ของบ้านเราไว้ตรงนี้
          </DialogDescription>
        </DialogHeader>
        <form
          className="form-stack"
          onSubmit={submit}
          key={initial?.id || "new"}
        >
          <div className="segmented">
            <button
              type="button"
              className={kind === "expense" ? "active" : ""}
              onClick={() => setKind("expense")}
            >
              ↗ รายจ่าย
            </button>
            <button
              type="button"
              className={kind === "income" ? "active" : ""}
              onClick={() => setKind("income")}
            >
              ↙ รายรับ
            </button>
          </div>
          <label>
            วันที่
            <Input
              type="date"
              name="date"
              defaultValue={initial?.date || localDate()}
              required
            />
          </label>
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
              min="0.01"
              step="0.01"
              placeholder="0.00"
              defaultValue={initial?.amount}
              required
            />
          </label>
          <Button type="submit" className="primary-button">
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
  const [period, setPeriod] = useState<Period>("week");
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<Transaction>();
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [copied, setCopied] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
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
    if (hasSession()) void reload();
    else setDb({ ...emptyDatabase(), loading: false });
  }, []);
  async function runRequest(action: () => Promise<unknown>) {
    setRequestError("");
    setDb((current) => ({ ...current, loading: true }));
    try {
      await action();
      await reload();
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
      <div className="setup-screen">
        <Brand />
        <div className="setup-card">
          <span className="eyebrow">KEBNOI CLUB</span>
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
    const password = String(data.get("password"));
    if (!name) {
      setProfileError("กรุณากรอกชื่อผู้ใช้");
      return;
    }
    if (password && password.length < 6) {
      setProfileError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }
    void runRequest(async () => {
      await updateProfile(name);
      if (email !== user!.email || password)
        await updateCredentials(email, password || undefined);
      setProfileMessage("บันทึกโปรไฟล์เรียบร้อยแล้ว");
    });
  }
  function uploadAvatar(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfileError(
      !file.type.startsWith("image/") || file.size > 1024 * 1024
        ? "กรุณาเลือกรูปภาพขนาดไม่เกิน 1 MB"
        : "รูปโปรไฟล์จะเปิดใช้หลังตั้งค่า Supabase Storage",
    );
  }
  function confirmAction() {
    if (!confirmation) return;
    if (confirmation.kind === "transaction") {
      const target = confirmation.transaction;
      if (target.userId === user!.id)
        void runRequest(() => deleteTransaction(target.id));
    } else if (confirmation.kind === "account") {
      void runRequest(async () => {
        await deleteAccount();
        setDb({ ...emptyDatabase(), loading: false });
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
  const list = page === "dashboard" ? transactions.slice(0, 5) : transactions;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="nav-caption">พื้นที่ของเรา</div>
        <nav>
          {nav.map((item) => (
            <button
              key={item.key}
              className={`nav-item ${page === item.key ? "active" : ""}`}
              onClick={() => {
                setPage(item.key);
                setProfileMessage("");
                setProfileError("");
              }}
            >
              <item.icon size={19} />
              <span>{item.label}</span>
              {page === item.key && <span className="nav-indicator" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <span className="tip-star">✦</span>
            <strong>ค่อย ๆ เก็บ ค่อย ๆ โต</strong>
            <p>ทุกบาทเล็ก ๆ มีความหมายกับบ้านของเราเสมอ</p>
            <PixelPal small />
          </div>
          <button className="sidebar-user" onClick={() => setPage("profile")}>
            <Avatar user={user} />
            <span>
              <strong>{user.name}</strong>
              <small>สมาชิกครอบครัว</small>
            </span>
            <ChevronDown size={16} />
          </button>
          <button className="logout" onClick={() => void runRequest(signOut)}>
            <LogOut size={16} /> ออกจากระบบ
          </button>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            บ้านของเรา <span>/</span>{" "}
            <strong>{nav.find((item) => item.key === page)?.label}</strong>
          </div>
          <div className="topbar-right">
            <span className="demo-pill">
              <span /> เชื่อมต่อแล้ว
            </span>
            <button
              className="top-avatar"
              onClick={() => setPage("profile")}
              aria-label="เปิดโปรไฟล์"
            >
              <Avatar user={user} />
            </button>
          </div>
        </header>
        <div className="mobile-nav">
          {nav.map((item) => (
            <button
              key={item.key}
              className={page === item.key ? "active" : ""}
              onClick={() => setPage(item.key)}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
        <div className="page-content">
          {requestError && (
            <p className="form-error" role="alert">
              {requestError}
            </p>
          )}
          {page === "dashboard" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="hello-line">
                    YOUR FAMILY SPACE <span>✦</span>
                  </div>
                  <h1>
                    สวัสดี, {user.name} <span className="wave">✳</span>
                  </h1>
                  <p>มาดูเรื่องเงินของบ้านเรากัน วันนี้เป็นยังไงบ้าง?</p>
                </div>
                <Button className="primary-button add-button" onClick={openNew}>
                  <Plus data-icon="inline-start" /> เพิ่มรายการ
                </Button>
              </div>
              <section className="welcome-banner">
                <div className="banner-copy">
                  <span className="banner-chip">
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
                <div className="banner-art">
                  <span className="banner-star star-a">✦</span>
                  <span className="banner-star star-b">✳</span>
                  <span className="banner-cloud cloud-a" />
                  <span className="banner-cloud cloud-b" />
                  <div className="banner-coin">฿</div>
                  <PixelPal />
                </div>
                <span className="banner-grid" />
              </section>
              <div className="section-heading summary-heading">
                <div>
                  <span className="eyebrow">THE BIG PICTURE</span>
                  <h2>
                    ภาพรวมของบ้านเรา <span>✦</span>
                  </h2>
                </div>
                <div
                  className="period-select"
                  role="group"
                  aria-label="เลือกช่วงเวลา"
                >
                  {(
                    [
                      ["today", "วันนี้"],
                      ["week", "7 วัน"],
                      ["month", "1 เดือน"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      className={period === value ? "active" : ""}
                      onClick={() => setPeriod(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-top">
                    <span className="stat-icon income">
                      <TrendingUp size={19} />
                    </span>
                    <span className="stat-meta">{periodLabel}</span>
                  </div>
                  <span className="stat-label">รายรับทั้งหมด</span>
                  <strong>฿{money(income)}</strong>
                  <small>
                    <span className="positive">↗</span> เงินที่เข้ามาในครอบครัว
                  </small>
                </div>
                <div className="stat-card">
                  <div className="stat-top">
                    <span className="stat-icon expense">
                      <TrendingDown size={19} />
                    </span>
                    <span className="stat-meta">{periodLabel}</span>
                  </div>
                  <span className="stat-label">รายจ่ายทั้งหมด</span>
                  <strong>฿{money(expense)}</strong>
                  <small>
                    <span className="negative">↗</span> เงินที่ใช้ไปร่วมกัน
                  </small>
                </div>
                <div className="stat-card">
                  <div className="stat-top">
                    <span className="stat-icon family-icon">
                      <Users size={19} />
                    </span>
                    <span className="stat-meta">ในครอบครัว</span>
                  </div>
                  <span className="stat-label">สมาชิกทั้งหมด</span>
                  <strong>
                    {members.length} <em>คน</em>
                  </strong>
                  <small>บ้านนี้มีเพื่อนร่วมเก็บออม</small>
                </div>
              </div>
              <div className="dashboard-grid">
                <section className="panel chart-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>เงินเข้า เงินออก</h2>
                      <p>ความเคลื่อนไหวของครอบครัว · {periodLabel}</p>
                    </div>
                    <div className="legend">
                      <span>
                        <i className="legend-income" />
                        รายรับ
                      </span>
                      <span>
                        <i className="legend-expense" />
                        รายจ่าย
                      </span>
                    </div>
                  </div>
                  <Chart transactions={filtered} period={period} />
                  {period === "today" && (
                    <small className="chart-note">
                      วันนี้แสดงตามเวลาที่บันทึกรายการ
                    </small>
                  )}
                </section>
                <section className="panel top-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>สายเปย์ประจำบ้าน</h2>
                      <p>รายจ่ายของทุกคน · {periodLabel}</p>
                    </div>
                    <span className="top-sparkle">✦</span>
                  </div>
                  <div className="spending-list">
                    {ranking.map(({ member, amount }, index) => (
                      <div className="spending-row" key={member.id}>
                        <span
                          className={
                            index === 0 && amount > 0
                              ? "spending-rank first"
                              : "spending-rank"
                          }
                        >
                          {index === 0 && amount > 0 ? "♛" : index + 1}
                        </span>
                        <Avatar user={member} />
                        <div className="spending-name">
                          <strong>
                            {member.name}
                            {member.id === user.id && (
                              <span className="you-badge"> คุณ</span>
                            )}
                          </strong>
                          <small>
                            {member.familyId === family.id
                              ? "สมาชิกครอบครัว"
                              : "ออกจากครอบครัวแล้ว"}
                          </small>
                        </div>
                        <strong className="spending-amount">
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
            <div className="page-heading">
              <div>
                <span className="eyebrow">ALL THE LITTLE THINGS</span>
                <h1>รายการทั้งหมด</h1>
                <p>ทุกเรื่องเงินของครอบครัว อยู่รวมกันตรงนี้</p>
              </div>
              <Button className="primary-button add-button" onClick={openNew}>
                <Plus data-icon="inline-start" /> เพิ่มรายการ
              </Button>
            </div>
          )}
          {(page === "dashboard" || page === "transactions") && (
            <section className="panel transactions-panel">
              <div className="panel-heading">
                <div>
                  <h2>
                    {page === "dashboard"
                      ? "รายการล่าสุด"
                      : "รายการของครอบครัว"}
                  </h2>
                  <p>เรื่องเล็ก ๆ ที่เราเพิ่งบันทึกไว้</p>
                </div>
                {page === "dashboard" && (
                  <button
                    className="view-all"
                    onClick={() => setPage("transactions")}
                  >
                    ดูทั้งหมด <ArrowRight size={15} />
                  </button>
                )}
              </div>
              <div className="transaction-list">
                {list.length === 0 ? (
                  <div className="empty-small">
                    ยังไม่มีรายการ ลองเพิ่มรายการแรกกัน
                  </div>
                ) : (
                  list.map((item) => {
                    const owner = db.users.find(
                      (member) => member.id === item.userId,
                    );
                    return (
                      <div className="transaction-row" key={item.id}>
                        <span className={`transaction-icon ${item.kind}`}>
                          {item.kind === "income" ? (
                            <ArrowDownLeft size={19} />
                          ) : (
                            <ArrowUpRight size={19} />
                          )}
                        </span>
                        <div className="transaction-name">
                          <strong>{item.description}</strong>
                          <span>
                            {dateText(item.date)} <i>·</i>{" "}
                            {owner?.name || "สมาชิก"}
                          </span>
                        </div>
                        <span className={`transaction-amount ${item.kind}`}>
                          {item.kind === "income" ? "+" : "−"}฿
                          {money(item.amount)}
                        </span>
                        {item.userId === user.id && (
                          <div className="row-actions">
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
              <div className="page-heading">
                <div>
                  <span className="eyebrow">BETTER TOGETHER</span>
                  <h1>ครอบครัวของเรา</h1>
                  <p>เพราะเรื่องเงินสนุกขึ้น เมื่อเราเก็บไปด้วยกัน</p>
                </div>
              </div>
              <div className="family-grid">
                <section className="panel family-card">
                  <div className="family-card-icon">
                    <House size={24} />
                  </div>
                  <span className="eyebrow">OUR LITTLE FAMILY</span>
                  <h2>{family.name}</h2>
                  <p>ส่งรหัสนี้ให้สมาชิก เพื่อชวนเข้าร่วมครอบครัว</p>
                  <div className="family-code">
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
                <section className="panel members-card">
                  <div className="panel-heading">
                    <div>
                      <h2>สมาชิกในบ้าน</h2>
                      <p>มีทั้งหมด {members.length} คน</p>
                    </div>
                    <Users size={20} />
                  </div>
                  {members.map((member) => (
                    <div className="member-row" key={member.id}>
                      <Avatar user={member} />
                      <div>
                        <strong>
                          {member.name}{" "}
                          {member.id === user.id && (
                            <span className="you-badge">คุณ</span>
                          )}
                        </strong>
                        <small>{member.email}</small>
                      </div>
                    </div>
                  ))}
                  <div className="leave-family">
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
              <div className="page-heading">
                <div>
                  <span className="eyebrow">A LITTLE ABOUT YOU</span>
                  <h1>โปรไฟล์ของฉัน</h1>
                  <p>จัดการข้อมูลส่วนตัวของคุณได้ที่นี่</p>
                </div>
              </div>
              <section className="panel profile-panel">
                <div className="profile-intro">
                  <Avatar user={user} size="large" />
                  <div>
                    <h2>{user.name}</h2>
                    <p>อัปโหลดรูปภาพขนาดไม่เกิน 1 MB</p>
                    <label className="upload-button">
                      เปลี่ยนรูปโปรไฟล์
                      <input
                        type="file"
                        accept="image/*"
                        onChange={uploadAvatar}
                      />
                    </label>
                  </div>
                </div>
                <form
                  className="form-stack profile-form"
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
                  <label>
                    รหัสผ่านใหม่
                    <Input
                      name="password"
                      type="password"
                      placeholder="เว้นว่างไว้หากไม่ต้องการเปลี่ยน"
                    />
                  </label>
                  {profileError && (
                    <p className="form-error" role="alert">
                      {profileError}
                    </p>
                  )}
                  {profileMessage && (
                    <p className="form-notice" role="status">
                      {profileMessage}
                    </p>
                  )}
                  <Button type="submit" className="primary-button">
                    บันทึกการเปลี่ยนแปลง
                  </Button>
                </form>
                <div className="danger-zone">
                  <div>
                    <strong>ลบบัญชี</strong>
                    <p>บัญชีและรายการส่วนตัวของคุณจะถูกลบอย่างถาวร</p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setConfirmation({ kind: "account" })}
                  >
                    ลบบัญชี
                  </Button>
                </div>
                <Button
                  variant="outline"
                  className="profile-logout"
                  onClick={() => void runRequest(signOut)}
                >
                  <LogOut data-icon="inline-start" /> ออกจากระบบ
                </Button>
              </section>
            </>
          )}
          <footer className="footer">
            <span>
              MADE WITH <span>♥</span> FOR LITTLE SAVERS
            </span>
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
        <DialogContent className="app-dialog confirm-dialog">
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
          <div className="confirm-actions">
            <Button variant="outline" onClick={() => setConfirmation(null)}>
              ยกเลิก
            </Button>
            <Button className="confirm-destructive" onClick={confirmAction}>
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
