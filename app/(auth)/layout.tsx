export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center px-5 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white font-serif text-3xl text-brand-800 shadow-sm ring-1 ring-stone-200">
            A
          </span>
          <p className="mt-4 text-sm font-medium text-stone-500">Agency OS</p>
        </div>
        {children}
      </div>
    </main>
  );
}
