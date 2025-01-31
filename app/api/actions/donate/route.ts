import {
    ACTIONS_CORS_HEADERS,
    ActionGetResponse,
    ActionPostRequest,
    ActionPostResponse,
    MEMO_PROGRAM_ID,
    createPostResponse,
  } from "@solana/actions";
  import {
    LAMPORTS_PER_SOL,
    Connection,
    PublicKey,
    Transaction,
    SystemProgram,
    clusterApiUrl,
  } from "@solana/web3.js";

  const DEFAULT_RPC = process.env.RPC_URL_MAINNET ?? clusterApiUrl("mainnet-beta");
  const DEFAULT_SOL_ADDRESS = new PublicKey("CKZGWXyLDRY2QGT6cRokNJkMnwXzyUF5RyAvQVJCwWKp")
  const DEFAULT_SOL_AMOUNT = 0.1;
  const DEFAULT_TITLE = "向 Shuang-Zi 转账"
  const DEFAULT_DESCRIPTION = "感谢您对 Shuang-Zi 的支持，您的每一次捐赠都是对 Shuang-Zi 的鼓励和肯定。"

  export const GET = async (req: Request) => {
    try {
      const requestUrl = new URL(req.url);
      const { toPubkey, amount } = validatedQueryParams(requestUrl);
      console.log("requestUrl", requestUrl);

      const baseHref = new URL(
        `/api/actions/donate?to=${toPubkey.toBase58()}`,
        requestUrl.origin
      ).toString();

      const payload: ActionGetResponse = {
        title: DEFAULT_TITLE,
        icon:
          new URL("/my_icon.jpg", requestUrl.origin).toString(),
        description: DEFAULT_DESCRIPTION,
        label: "Transfer", // this value will be ignored since `links.actions` exists
        links: {
          actions: [
            {
              label: `Send ${amount} SOL`, // button text
              href: `${baseHref}&amount=${amount}`,
            },
            {
              label: "search", // button text
              href: `/api/actions/donate?action=search`,
            },
          ],
        },
      };

      return Response.json(payload, {
        headers: ACTIONS_CORS_HEADERS,
      });
    } catch (err) {
      console.log(err);
      let message = "An unknown error occurred";
      if (typeof err == "string") message = err;
      return new Response(message, {
        status: 400,
        headers: ACTIONS_CORS_HEADERS,
      });
    }
  };
  // DO NOT FORGET TO INCLUDE THE `OPTIONS` HTTP METHOD
  // THIS WILL ENSURE CORS WORKS FOR BLINKS
  export const OPTIONS = GET;

  export const POST = async (req: Request) => {
    try {
      const requestUrl = new URL(req.url);
      console.log("requestUrl", requestUrl);
      const { amount, toPubkey } = validatedQueryParams(requestUrl);

      const body: ActionPostRequest = await req.json();
      if (requestUrl.searchParams.get("action")) {
        console.log("search action!!");

      }
      // validate the client provided input
      let account: PublicKey;
      try {
        account = new PublicKey(body.account);
      } catch (err) {
        return new Response('Invalid "account" provided', {
          status: 400,
          headers: ACTIONS_CORS_HEADERS,
        });
      }

      const connection = new Connection(DEFAULT_RPC);

      // ensure the receiving account will be rent exempt
      const minimumBalance = await connection.getMinimumBalanceForRentExemption(
        0 // note: simple accounts that just store native SOL have `0` bytes of data
      );
      if (amount * LAMPORTS_PER_SOL < minimumBalance) {
        throw `account may not be rent exempt: ${toPubkey.toBase58()}`;
      }

      const transaction = new Transaction();
      transaction.feePayer = account;

      transaction.add(
        SystemProgram.transfer({
          fromPubkey: account,
          toPubkey: toPubkey,
          lamports: amount * LAMPORTS_PER_SOL,
        })
      );

      // set the end user as the fee payer
      transaction.feePayer = account;

      transaction.recentBlockhash = (
        await connection.getLatestBlockhash()
      ).blockhash;

      const payload: ActionPostResponse = await createPostResponse({
        fields: {
          transaction,
          message: `Send ${amount} SOL to ${toPubkey.toBase58()}`,
        },
        // note: no additional signers are needed
        // signers: [],
      });

      return Response.json(payload, {
        headers: ACTIONS_CORS_HEADERS,
      });
    } catch (err) {
      console.log(err);
      let message = "An unknown error occurred";
      if (typeof err == "string") message = err;
      return new Response(message, {
        status: 400,
        headers: ACTIONS_CORS_HEADERS,
      });
    }
  };

  function validatedQueryParams(requestUrl: URL) {
    let toPubkey: PublicKey = DEFAULT_SOL_ADDRESS;
    let amount: number = DEFAULT_SOL_AMOUNT;

    try {
      if (requestUrl.searchParams.get("to")) {
        toPubkey = new PublicKey(requestUrl.searchParams.get("to")!);
      }
    } catch (err) {
      throw "Invalid input query parameter: to";
    }

    try {
      if (requestUrl.searchParams.get("amount")) {
        amount = parseFloat(requestUrl.searchParams.get("amount")!);
      }

      if (amount <= 0) throw "amount is too small";
    } catch (err) {
      throw "Invalid input query parameter: amount";
    }

    return {
      amount,
      toPubkey,
    };
  }