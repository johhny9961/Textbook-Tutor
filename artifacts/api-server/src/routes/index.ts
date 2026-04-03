import { Router, type IRouter } from "express";
import healthRouter from "./health";
import chatRouter from "./chat";
import pdfRouter from "./parsePdf";
import booksRouter from "./books";

const router: IRouter = Router();

router.use(healthRouter);
router.use(chatRouter);
router.use(pdfRouter);
router.use(booksRouter);

export default router;
