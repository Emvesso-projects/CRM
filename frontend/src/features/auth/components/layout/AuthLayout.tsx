import type { ReactNode } from "react";
import loginBg from "@/assets/images/login-bg.svg";
import logoImg from "@/assets/images/logo.svg";

interface AuthLayoutProps {
  children: ReactNode;
}

const AuthLayout = ({ children }: AuthLayoutProps) => {
  return (
    <div
      className="h-[100svh] max-h-[100svh] overflow-hidden bg-cover bg-[30%_center] text-foreground sm:bg-left lg:h-[100vh] lg:max-h-[100vh] lg:bg-left"
      style={{ backgroundImage: `url(${loginBg})` }}
    >
      <main className="flex h-full w-full items-center justify-center overflow-hidden px-4 py-3 sm:px-8 md:px-10 lg:justify-end lg:py-5 lg:pr-[4.7vw] xl:pr-[4.8vw] 2xl:pr-[5vw]">
        <section className="flex max-h-[calc(100svh-24px)] w-full max-w-[370px] flex-col overflow-x-hidden overflow-y-auto rounded-[24px] border border-white/80 bg-white px-6 py-6 shadow-[0_22px_60px_rgba(25,38,95,0.15)] sm:max-w-[410px] sm:px-8 sm:py-7 lg:mr-[clamp(2rem,8vw,7.5rem)] lg:h-auto lg:max-h-[calc(100vh-40px)] lg:min-h-[clamp(500px,65vh,610px)] lg:w-[clamp(430px,35.25vw,510px)] lg:max-w-none lg:rounded-[28px] lg:px-12 lg:py-9 [@media(max-height:680px)]:py-4">
          <div className="flex min-h-0 flex-1 flex-col justify-center">
            {/* Header Brand */}
            <div className="mb-6 flex items-center justify-center gap-2 lg:mb-7">
              <img
                src={logoImg}
                alt="CRM Logo"
                className="h-5 w-5 shrink-0 object-contain lg:h-6 lg:w-6"
              />
              <span className="text-sm font-bold leading-none text-primary">
                EMVESSO CRM
              </span>
            </div>
            {children}
          </div>
        </section>
      </main>
    </div>
  );
};

export default AuthLayout;
