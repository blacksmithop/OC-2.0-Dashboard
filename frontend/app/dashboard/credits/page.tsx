import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function CreditsPage() {
  const credits = [
    {
      name: "Allenone",
      id: "2033011",
      contribution: "For the honest feedback and providing an API for",
      apiText: "Role Weights & Probability",
      link: "https://tornprobability.com:3000/api-docs",
    },
    {
      name: "Emforus",
      id: "2535044",
      contribution: "For the awesome Crimes 2.0 guides and their simulator ",
      apiText: "CrimesHub",
      link: "https://crimeshub-2b4b0.firebaseapp.com/",
    },
    {
      name: "zachwozn",
      id: "2301700",
      contribution:
        "Highlighting importance of transparency on API Key and data usage",
    },
    {
      name: "DinDjarin",
      id: "3275819",
      contribution:
        "For the suggestion to add historical filtering and back-filling of older OC's",
    },
    {
      name: "Weav3r",
      id: "1853324",
      contribution: "For creating and maintaining the awesome",
      apiText: "weav3r.dev",
      link: "https://weav3r.dev/api-docs.html",
    },
    {
      name: "TheBurninator",
      id: "2744382",
      contribution: "For suggesting the addition of Armoy & Funds page",
    },
    {
      name: "Macca",
      id: "508375",
      contribution:
        "Without you and your support I wouldn't have made this dashboard in the first place",
    },
    {
      names: ["Exiled", "NoNitro"],
      ids: ["3527247", "3562297"],
      contribution: "For all the feedback",
    },
    {
      name: "SmiLego",
      id: "3656385",
      contribution: "For pointing out the little things that make UX better",
    },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card p-6">
        <div className="max-w-3xl mx-auto">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft size={18} />
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-foreground">Credits</h1>
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="max-w-3xl mx-auto">
          <p className="text-muted-foreground mb-6">
            This site was made possible thanks to the suggestions and feedback
            from a lot of users. Some of the functionality you see makes use of
            APIs, userscripts and data provided by members of the community.
          </p>

          <ul className="space-y-4 list-none">
            {credits.map((credit, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="text-muted-foreground mt-1">•</span>
                <div className="flex-1">
                  {credit.names ? (
                    // Multiple people grouped together
                    <div className="flex flex-wrap items-center gap-2">
                      {credit.names.map((name, i) => (
                        <span key={i}>
                          <a
                            href={`https://www.torn.com/profiles.php?XID=${
                              credit.ids![i]
                            }`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-primary hover:text-primary/80 transition-colors"
                          >
                            {name} [{credit.ids![i]}]
                          </a>
                          {i < credit.names.length - 1 && (
                            <span className="text-muted-foreground"> and </span>
                          )}
                        </span>
                      ))}
                      <span className="text-foreground">
                        {" "}
                        {credit.contribution}
                      </span>
                    </div>
                  ) : (
                    // Single person
                    <div>
                      <a
                        href={`https://www.torn.com/profiles.php?XID=${credit.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-primary hover:text-primary/80 transition-colors"
                      >
                        {credit.name} [{credit.id}]
                      </a>
                      <span className="text-foreground">
                        {" "}
                        {credit.contribution}
                      </span>
                      {credit.apiText && credit.link && (
                        <>
                          {" "}
                          <a
                            href={credit.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent hover:text-accent/80 transition-colors"
                          >
                            {credit.apiText}
                          </a>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-8 pt-6 border-t border-border">
            <p className="text-foreground">
              And last but not the least,{" "}
              <span className="text-primary font-semibold">you</span> for using
              my application :)
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-border bg-card px-6 py-4">
        <div className="text-center text-sm">
          <a
            href="https://www.torn.com/profiles.php?XID=1712955"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white hover:text-white/80 transition-colors"
          >
            © oxiblurr [1712955]
          </a>
        </div>
      </footer>
    </div>
  );
}
