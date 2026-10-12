import { Router, type IRouter } from "express";
import healthRouter from "./health";
import discoveryRouter from "./discovery";
import accountRouter from "./account";
import sellerRouter from "./seller";
import conversationsRouter from "./conversations";
import premiumRouter from "./premium";
import adminRouter from "./admin";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(discoveryRouter);
router.use(accountRouter);
router.use(sellerRouter);
router.use(conversationsRouter);
router.use(premiumRouter);
router.use(adminRouter);
router.use(storageRouter);

export default router;
