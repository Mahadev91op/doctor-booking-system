const mongoose = require("mongoose");

const dailyCounterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  count: { type: Number, default: 0 },
});

dailyCounterSchema.statics.incrementToken = async function (counterId) {
  const counter = await this.findByIdAndUpdate(
    counterId,
    { $inc: { count: 1 } },
    { new: true, upsert: true }
  );
  return counter.count;
};

dailyCounterSchema.statics.incrementAndCheckLimit = async function (
  counterId,
  limit
) {
  const counter = await this.findOneAndUpdate(
    { _id: counterId, count: { $lt: limit } },
    { $inc: { count: 1 } },
    { new: true }
  );
  if (counter) return counter.count;

  const existing = await this.findById(counterId);
  if (existing && existing.count >= limit) return false;

  if (!existing) {
    try {
      const created = await this.create({ _id: counterId, count: 1 });
      return created.count;
    } catch (err) {
      if (err.code === 11000) {
        const retry = await this.findOneAndUpdate(
          { _id: counterId, count: { $lt: limit } },
          { $inc: { count: 1 } },
          { new: true }
        );
        return retry ? retry.count : false;
      }
      throw err;
    }
  }
  return false;
};

// Compensation rollback logic: Decrements counter when appointment persistence fails
dailyCounterSchema.statics.decrementToken = async function (counterId) {
  const counter = await this.findByIdAndUpdate(
    counterId,
    { $inc: { count: -1 } },
    { new: true }
  );
  if (counter && counter.count < 0) {
    await this.findByIdAndUpdate(counterId, { $set: { count: 0 } });
  }
  return counter ? counter.count : 0;
};

module.exports = mongoose.model("DailyCounter", dailyCounterSchema);
