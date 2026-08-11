import Button from "../components/Button";

function Login() {
  return (
    <>
      <div className="flex flex-col h-screen items-center justify-center gap-8">
        <div className="login-title">
          <h2>Serichai Web Portal</h2>
        </div>
        <div className="login-content w-112.5">
          <div className="login-form flex flex-col gap-6 py-8 px-4 border border-[#E5E7EB] sm:rounded-xl sm:px-10">
            <fieldset className="fieldset">
              <legend className="fieldset-legend">Username</legend>
              <input type="text" id="username" className="input w-full" placeholder="Username" />
            </fieldset>
            <fieldset className="fieldset">
              <legend className="fieldset-legend">Password</legend>
              <input type="password" id="password" className="input w-full" placeholder="Password" />
            </fieldset>
            <Button onClick={() => console.log("test")} className="bg-primary-cont text-on-primary-cont px-4 py-2 rounded">
              Sign in
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

export default Login;
