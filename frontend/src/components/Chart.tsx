import {
  localDate,
  money,
  type Period,
  type Transaction,
} from "../domain/model";
import { curvePath } from "../domain/chart";

export function Chart({
  transactions,
  period,
}: {
  transactions: Transaction[];
  period: Period;
}) {
  const now = new Date();
  const count = period === "today" ? 6 : period === "week" ? 7 : now.getDate();
  const buckets = Array.from({ length: count }, (_, i) => {
    const day =
      period === "week"
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6 + i)
        : new Date(now.getFullYear(), now.getMonth(), i + 1);
    const items = transactions.filter((t) =>
      period === "today"
        ? Math.min(5, Math.floor((t.recordedHour ?? 12) / 4)) === i
        : t.date === localDate(day),
    );
    return {
      label:
        period === "today"
          ? `${String(i * 4).padStart(2, "0")}:00`
          : `${day.getDate()} ${day.toLocaleDateString("th-TH", { month: "short" })}`,
      income: items
        .filter((t) => t.kind === "income")
        .reduce((sum, t) => sum + t.amount, 0),
      expense: items
        .filter((t) => t.kind === "expense")
        .reduce((sum, t) => sum + t.amount, 0),
    };
  });
  const max = Math.max(100, ...buckets.flatMap((b) => [b.income, b.expense]));
  return (
    <div className="chart-wrap">
      <div className="chart-values">
        <span>฿{money(max)}</span>
        <span>฿{money(max / 2)}</span>
        <span>฿0</span>
      </div>
      <div className="chart-main">
        <svg
          className="chart"
          viewBox="-1 0 102 100"
          preserveAspectRatio="none"
          role="img"
          aria-label="กราฟเปรียบเทียบรายรับและรายจ่าย"
        >
          <line x1="0" y1="15" x2="100" y2="15" />
          <line x1="0" y1="52.5" x2="100" y2="52.5" />
          <line x1="0" y1="90" x2="100" y2="90" />
          <path
            className="chart-income"
            d={curvePath(
              buckets.map((b) => b.income),
              max,
            )}
          />
          <path
            className="chart-expense"
            d={curvePath(
              buckets.map((b) => b.expense),
              max,
            )}
          />
        </svg>
        <div className="chart-labels">
          {buckets.map((bucket, i) => (
            <span key={i}>
              {count > 10 && i !== 0 && i !== count - 1 && i % 5 !== 0
                ? ""
                : bucket.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
