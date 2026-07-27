import { ExternalLink, MessageCircleWarning, ShieldCheck } from "lucide-react";
import { reportIssueUrl } from "../lib/site";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <strong>이은이 아빠가 준비하는 육아템</strong>
          <span>
            매일 자동으로 판매 경로를 점검하고 검증된 정보만 반영합니다.
          </span>
        </div>
        <nav aria-label="사이트 운영 정보">
          <a href="#verification-policy">
            <ShieldCheck size={15} aria-hidden="true" />
            검증 기준
          </a>
          <a href={reportIssueUrl()} target="_blank" rel="noopener noreferrer">
            <MessageCircleWarning size={15} aria-hidden="true" />
            정보 오류 신고
            <ExternalLink size={13} aria-hidden="true" />
          </a>
        </nav>
        <p className="privacy-note">
          회원가입이나 서버 개인정보 저장 기능은 없습니다. 찜 목록과 화면 테마는
          현재 브라우저에만 저장됩니다.
        </p>
        <p className="affiliate-notice">
          일부 구매 링크는 제휴 링크일 수 있으며, 구매 시 운영자에게 수수료가
          지급될 수 있습니다. 구매 가격에는 영향을 주지 않습니다.
        </p>
        <p className="copyright">© 2026 손홍백. All rights reserved.</p>
      </div>
    </footer>
  );
}
