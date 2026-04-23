import { Router, type IRouter } from "express";
import healthRouter from "./health";
import chatRouter from "./chat";
import pdfRouter from "./parsePdf";
import booksRouter from "./books";
import scrapeRouter from "./scrape";

const router: IRouter = Router();

router.use(healthRouter);
router.use(chatRouter);
router.use(pdfRouter);
router.use(booksRouter);
router.use(scrapeRouter);

export default router;
